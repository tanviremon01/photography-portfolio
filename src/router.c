#include "router.h"
#include "api.h"
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
        "Content-Length: %d\r\n"
        "Connection: close\r\n"
        "\r\n"
        "%s",
        status_code, status_text, body_len, body_message);
    send(client_socket, response, len, 0);
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

    /* We only support GET requests */
    if (_stricmp(method, "GET") != 0) {
        send_error(client_socket, 405, "Method Not Allowed",
                   "<h1>405 Method Not Allowed</h1>");
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

    /* ---- API Routes ---- */
    if (strcmp(path, "/api/portfolio") == 0) {
        handle_api_portfolio(client_socket, query_string);
        return;
    }

    /* ---- Static File Routes ---- */
    serve_static_file(client_socket, path);
}
