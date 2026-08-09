#include "router.h"
#include "api.h"
#include "admin.h"
#include "mime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* -----------------------------------------------------------------------
 * Base directory for static files, relative to the executable.
 * All static file requests are resolved under this path.
 * ----------------------------------------------------------------------- */
#define PUBLIC_DIR "public"

/* Maximum path length for resolved file paths */
#define MAX_PATH_LEN 1024

/* Maximum file size to serve (50 MB) */
#define MAX_FILE_SIZE (50 * 1024 * 1024)

/* Maximum POST body size (25 MB — enough for large images) */
#define MAX_BODY_SIZE (25 * 1024 * 1024)

/* -----------------------------------------------------------------------
 * Helper: send a complete HTTP error response.
 * ----------------------------------------------------------------------- */
static void send_error(SOCKET client_socket, int status_code,
                       const char *status_text, const char *body_message) {
    char response[1024];
    int body_len = (int)strlen(body_message);
    int len = snprintf(response, sizeof(response),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: text/html; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Content-Length: %d\r\n"
        "Connection: close\r\n"
        "\r\n"
        "%s",
        status_code, status_text, body_len, body_message);
    send(client_socket, response, len, 0);
}

/* -----------------------------------------------------------------------
 * Helper: send CORS preflight response for OPTIONS requests.
 * ----------------------------------------------------------------------- */
static void send_cors_preflight(SOCKET client_socket) {
    char response[512];
    int len = snprintf(response, sizeof(response),
        "HTTP/1.1 204 No Content\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, X-Admin-Token\r\n"
        "Access-Control-Max-Age: 86400\r\n"
        "Content-Length: 0\r\n"
        "Connection: close\r\n"
        "\r\n");
    send(client_socket, response, len, 0);
}

/* -----------------------------------------------------------------------
 * Helper: parse Content-Length from HTTP headers.
 * Returns the value, or 0 if not found.
 * ----------------------------------------------------------------------- */
static long parse_content_length(const char *headers) {
    /* Try various capitalizations */
    const char *patterns[] = {
        "Content-Length: ", "Content-Length:",
        "content-length: ", "content-length:"
    };
    for (int i = 0; i < 4; i++) {
        const char *pos = strstr(headers, patterns[i]);
        if (pos) {
            pos += strlen(patterns[i]);
            while (*pos == ' ') pos++;
            return atol(pos);
        }
    }
    return 0;
}

/* -----------------------------------------------------------------------
 * Helper: read the full POST body from the socket.
 *
 * The initial recv() in server.c captured headers + possibly some body
 * bytes. This function reads the remainder of the body based on
 * Content-Length.
 *
 * Returns a malloc'd buffer (caller must free), or NULL on error.
 * Sets *out_size to the actual body size read, or -1 on fatal error.
 * ----------------------------------------------------------------------- */
static char *read_post_body(SOCKET socket, const char *request,
                            int request_len, long *out_size) {
    *out_size = 0;

    /* Locate end of headers */
    const char *hdr_end = strstr(request, "\r\n\r\n");
    if (!hdr_end) return NULL;
    const char *body_start = hdr_end + 4;

    /* Parse Content-Length */
    long content_length = parse_content_length(request);
    if (content_length <= 0) return NULL;
    if (content_length > MAX_BODY_SIZE) {
        *out_size = -1; /* signal: too large */
        return NULL;
    }

    /* Calculate how many body bytes are already in the buffer */
    long header_size = (long)(body_start - request);
    long body_already = request_len - header_size;
    if (body_already < 0) body_already = 0;
    if (body_already > content_length) body_already = content_length;

    /* Allocate buffer for the full body */
    char *body = (char *)malloc((size_t)content_length + 1);
    if (!body) {
        *out_size = -1;
        return NULL;
    }

    /* Copy bytes we already received */
    if (body_already > 0) {
        memcpy(body, body_start, (size_t)body_already);
    }

    /* Read remaining bytes from the socket */
    long total = body_already;
    while (total < content_length) {
        int want = (int)((content_length - total) > 8192
                         ? 8192 : (content_length - total));
        int got = recv(socket, body + total, want, 0);
        if (got <= 0) break; /* connection closed or error */
        total += got;
    }

    body[total] = '\0';
    *out_size = total;
    return body;
}

/* -----------------------------------------------------------------------
 * Helper: serve a static file from the public/ directory.
 * ----------------------------------------------------------------------- */
static void serve_static_file(SOCKET client_socket, const char *url_path) {
    /* Build the filesystem path */
    char filepath[MAX_PATH_LEN];

    /* Default "/" to "/index.html" */
    if (strcmp(url_path, "/") == 0) {
        url_path = "/index.html";
    }

    snprintf(filepath, sizeof(filepath), "%s%s", PUBLIC_DIR, url_path);

    /* Security: reject paths containing ".." to prevent directory traversal */
    if (strstr(filepath, "..")) {
        send_error(client_socket, 403, "Forbidden",
                   "<h1>403 Forbidden</h1>");
        return;
    }

    /* Convert forward slashes to backslashes for Windows */
    for (char *p = filepath; *p; p++) {
        if (*p == '/') *p = '\\';
    }

    /* Open and read the file */
    FILE *fp = fopen(filepath, "rb");
    if (!fp) {
        send_error(client_socket, 404, "Not Found",
                   "<h1>404 Not Found</h1><p>The requested resource was not found.</p>");
        return;
    }

    fseek(fp, 0, SEEK_END);
    long file_size = ftell(fp);
    fseek(fp, 0, SEEK_SET);

    if (file_size < 0 || file_size > MAX_FILE_SIZE) {
        fclose(fp);
        send_error(client_socket, 500, "Internal Server Error",
                   "<h1>500 Internal Server Error</h1>");
        return;
    }

    char *file_data = (char *)malloc((size_t)file_size);
    if (!file_data) {
        fclose(fp);
        send_error(client_socket, 500, "Internal Server Error",
                   "<h1>500 Internal Server Error</h1>");
        return;
    }

    fread(file_data, 1, (size_t)file_size, fp);
    fclose(fp);

    /* Determine MIME type from file extension */
    const char *ext = strrchr(url_path, '.');
    const char *mime = get_mime_type(ext);

    /* Send HTTP headers */
    char header[512];
    int header_len = snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %ld\r\n"
        "Cache-Control: no-cache\r\n"
        "Connection: close\r\n"
        "\r\n",
        mime, file_size);
    send(client_socket, header, header_len, 0);

    /* Send file body in chunks */
    long sent = 0;
    while (sent < file_size) {
        int chunk = (file_size - sent > 8192) ? 8192 : (int)(file_size - sent);
        int result = send(client_socket, file_data + sent, chunk, 0);
        if (result <= 0) break;
        sent += result;
    }

    free(file_data);
}

/* -----------------------------------------------------------------------
 * Main router: parses the HTTP request line and dispatches.
 *
 * Supports:
 *   GET     — static files + portfolio API
 *   POST    — admin API (upload, save, verify, delete)
 *   OPTIONS — CORS preflight
 * ----------------------------------------------------------------------- */
void route_request(SOCKET client_socket, const char *request, int request_len) {
    (void)request_len;

    /* Parse the request line: "METHOD /path HTTP/1.x" */
    char method[16] = {0};
    char full_path[MAX_PATH_LEN] = {0};

    if (sscanf(request, "%15s %1023s", method, full_path) != 2) {
        send_error(client_socket, 400, "Bad Request",
                   "<h1>400 Bad Request</h1>");
        return;
    }

    /* Split path and query string */
    char path[MAX_PATH_LEN] = {0};
    char *query_string = NULL;

    snprintf(path, sizeof(path), "%s", full_path);
    char *qmark = strchr(path, '?');
    if (qmark) {
        *qmark = '\0';
        query_string = qmark + 1;
    }

    /* Log the request */
    printf("[REQUEST] %s %s", method, path);
    if (query_string) printf("?%s", query_string);
    printf("\n");

    /* ---- CORS Preflight ---- */
    if (_stricmp(method, "OPTIONS") == 0) {
        send_cors_preflight(client_socket);
        return;
    }

    /* ---- GET Routes ---- */
    if (_stricmp(method, "GET") == 0) {
        if (strcmp(path, "/api/portfolio") == 0) {
            handle_api_portfolio(client_socket, query_string);
            return;
        }
        /* All other GET requests serve static files */
        serve_static_file(client_socket, path);
        return;
    }

    /* ---- POST Routes (admin API) ---- */
    if (_stricmp(method, "POST") == 0) {
        /* All POST routes require admin authentication */
        if (!check_admin_auth(request)) {
            send_error(client_socket, 401, "Unauthorized",
                       "{\"error\":\"Unauthorized\"}");
            return;
        }

        /* Verify endpoint doesn't need a body */
        if (strcmp(path, "/api/admin/verify") == 0) {
            handle_admin_verify(client_socket);
            return;
        }

        /* Delete endpoint doesn't need a body either */
        if (strcmp(path, "/api/upload/delete") == 0) {
            handle_admin_delete_file(client_socket, query_string);
            return;
        }

        /* Read the POST body for remaining endpoints */
        long body_size = 0;
        char *body = read_post_body(client_socket, request,
                                     request_len, &body_size);

        if (body_size == -1) {
            send_error(client_socket, 413, "Payload Too Large",
                       "{\"error\":\"File too large (max 25 MB)\"}");
            if (body) free(body);
            return;
        }

        /* Route to the appropriate handler */
        if (strcmp(path, "/api/upload") == 0) {
            handle_admin_upload(client_socket, query_string,
                                body, body_size);
        } else if (strcmp(path, "/api/portfolio/save") == 0) {
            handle_admin_save_portfolio(client_socket, body, body_size);
        } else {
            send_error(client_socket, 404, "Not Found",
                       "{\"error\":\"Unknown API endpoint\"}");
        }

        if (body) free(body);
        return;
    }

    /* ---- Unsupported Method ---- */
    send_error(client_socket, 405, "Method Not Allowed",
               "<h1>405 Method Not Allowed</h1>");
}
