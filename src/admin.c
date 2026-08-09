/**
 * =========================================================================
 *  Admin API Handlers
 * =========================================================================
 *
 *  Provides endpoints for the admin dashboard:
 *    - Token-based authentication
 *    - Image file upload (raw binary POST)
 *    - Portfolio JSON save (full overwrite)
 *    - Image file deletion
 *
 *  Security: Uses a compile-time admin token. Adequate for a personal
 *  portfolio; NOT suitable for production with sensitive data.
 * =========================================================================
 */

#include "admin.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <direct.h>

/* -----------------------------------------------------------------------
 * Configuration
 * ----------------------------------------------------------------------- */
#define ADMIN_PASS_PATH     "src\\admin_pass.txt"
#define PORTFOLIO_JSON_PATH "src\\portfolio_data.json"
#define UPLOAD_DIR          "public\\images\\"
#define MAX_FNAME           256

/* -----------------------------------------------------------------------
 * Helper: send a JSON HTTP response with CORS headers.
 * ----------------------------------------------------------------------- */
static void send_json(SOCKET sock, int code, const char *status,
                      const char *body) {
    size_t blen = strlen(body);
    char hdr[512];
    int hlen = snprintf(hdr, sizeof(hdr),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Headers: Content-Type, X-Admin-Token\r\n"
        "Cache-Control: no-cache\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "\r\n",
        code, status, blen);
    send(sock, hdr, hlen, 0);
    send(sock, body, (int)blen, 0);
}

/* -----------------------------------------------------------------------
 * Helper: URL-decode a string.
 * ----------------------------------------------------------------------- */
static void url_decode(const char *src, char *dst, size_t max) {
    size_t i = 0;
    while (*src && i < max - 1) {
        if (*src == '%' && src[1] && src[2]) {
            char hex[3] = { src[1], src[2], 0 };
            dst[i++] = (char)strtol(hex, NULL, 16);
            src += 3;
        } else if (*src == '+') {
            dst[i++] = ' ';
            src++;
        } else {
            dst[i++] = *src++;
        }
    }
    dst[i] = '\0';
}

/* -----------------------------------------------------------------------
 * Helper: extract a query parameter value (URL-decoded).
 * Returns 1 if found, 0 otherwise.
 * ----------------------------------------------------------------------- */
static int get_param(const char *qs, const char *key,
                     char *out, size_t max) {
    if (!qs || !key) return 0;
    size_t klen = strlen(key);
    const char *p = qs;

    while (*p) {
        if (strncmp(p, key, klen) == 0 && p[klen] == '=') {
            const char *vs = p + klen + 1;
            const char *ve = strchr(vs, '&');
            size_t vlen = ve ? (size_t)(ve - vs) : strlen(vs);
            /* Decode into output */
            char raw[MAX_FNAME];
            if (vlen >= sizeof(raw)) vlen = sizeof(raw) - 1;
            memcpy(raw, vs, vlen);
            raw[vlen] = '\0';
            url_decode(raw, out, max);
            return 1;
        }
        const char *amp = strchr(p, '&');
        if (!amp) break;
        p = amp + 1;
    }
    return 0;
}

/* -----------------------------------------------------------------------
 * Helper: get current admin password from file
 * ----------------------------------------------------------------------- */
static void get_admin_password(char *out, size_t max) {
    FILE *fp = fopen(ADMIN_PASS_PATH, "r");
    if (!fp) {
        /* Fallback if file missing */
        strncpy(out, "tanvir2026", max);
        return;
    }
    if (fgets(out, (int)max, fp)) {
        /* trim newline */
        size_t len = strlen(out);
        while (len > 0 && (out[len-1] == '\r' || out[len-1] == '\n')) {
            out[--len] = '\0';
        }
    } else {
        strncpy(out, "tanvir2026", max);
    }
    fclose(fp);
}

/* -----------------------------------------------------------------------
 * Check admin authentication from request headers.
 * ----------------------------------------------------------------------- */
int check_admin_auth(const char *request) {
    /* Try both cases for the header name */
    const char *pos = strstr(request, "X-Admin-Token:");
    if (!pos) pos = strstr(request, "x-admin-token:");
    if (!pos) pos = strstr(request, "X-admin-token:");
    if (!pos) return 0;

    pos += 14; /* skip "X-Admin-Token:" */
    while (*pos == ' ') pos++;

    char current_pass[128] = {0};
    get_admin_password(current_pass, sizeof(current_pass));
    size_t tlen = strlen(current_pass);

    if (strncmp(pos, current_pass, tlen) == 0) {
        char c = pos[tlen];
        if (c == '\r' || c == '\n' || c == '\0') return 1;
    }
    return 0;
}

/* -----------------------------------------------------------------------
 * POST /api/admin/verify — confirm authentication.
 * ----------------------------------------------------------------------- */
void handle_admin_verify(SOCKET sock) {
    send_json(sock, 200, "OK", "{\"authenticated\":true}");
}

/* -----------------------------------------------------------------------
 * POST /api/admin/password — change admin password.
 * Request body should contain new password in plain text.
 * ----------------------------------------------------------------------- */
void handle_admin_change_password(SOCKET sock, const char *body, long body_size) {
    if (!body || body_size <= 0) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"No password provided\"}");
        return;
    }
    
    char new_pass[128] = {0};
    size_t to_copy = body_size < sizeof(new_pass) - 1 ? (size_t)body_size : sizeof(new_pass) - 1;
    memcpy(new_pass, body, to_copy);
    
    /* Remove surrounding quotes if sent as a JSON string literal */
    if (new_pass[0] == '"' && new_pass[to_copy-1] == '"' && to_copy >= 2) {
        memmove(new_pass, new_pass + 1, to_copy - 2);
        to_copy -= 2;
        new_pass[to_copy] = '\0';
    }

    /* Trim trailing whitespace/newlines that might come from HTTP body */
    while (to_copy > 0 && (new_pass[to_copy-1] == '\r' || new_pass[to_copy-1] == '\n' || new_pass[to_copy-1] == ' ')) {
        new_pass[to_copy-1] = '\0';
        to_copy--;
    }

    FILE *fp = fopen(ADMIN_PASS_PATH, "w");
    if (!fp) {
        send_json(sock, 500, "Internal Server Error", "{\"error\":\"Failed to save password\"}");
        return;
    }
    fprintf(fp, "%s", new_pass);
    fclose(fp);

    send_json(sock, 200, "OK", "{\"success\":true,\"message\":\"Password updated\"}");
    printf("[ADMIN] Password changed successfully.\n");
}

/* -----------------------------------------------------------------------
 * POST /api/admin/forgot — trigger Python script to send reset email.
 * NO AUTH REQUIRED.
 * ----------------------------------------------------------------------- */
void handle_admin_forgot_password(SOCKET sock) {
    printf("[ADMIN] Triggering password reset email script...\n");
    
    /* Run Python script synchronously */
    int res = system("python send_reset.py");
    
    if (res == 0) {
        send_json(sock, 200, "OK", "{\"success\":true,\"message\":\"Reset email sent\"}");
    } else {
        send_json(sock, 500, "Internal Server Error", "{\"error\":\"Failed to send email. Check configuration.\"}");
    }
}

/* -----------------------------------------------------------------------
 * POST /api/upload — save uploaded image file.
 *
 * The request body contains raw image bytes.
 * Query parameters:
 *   filename  (required) — the target filename
 *   folder    (optional) — subdirectory under images/
 * ----------------------------------------------------------------------- */
void handle_admin_upload(SOCKET sock, const char *qs,
                         const char *body, long body_size) {
    if (!body || body_size <= 0) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"No file data\"}");
        return;
    }

    /* Extract filename */
    char filename[MAX_FNAME] = {0};
    if (!get_param(qs, "filename", filename, sizeof(filename)) || !filename[0]) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"Missing filename\"}");
        return;
    }

    /* Security: keep only the base filename */
    char *s = strrchr(filename, '/');
    if (s) memmove(filename, s + 1, strlen(s));
    s = strrchr(filename, '\\');
    if (s) memmove(filename, s + 1, strlen(s));

    if (strstr(filename, "..") || !filename[0]) {
        send_json(sock, 403, "Forbidden", "{\"error\":\"Invalid filename\"}");
        return;
    }

    /* Optional subfolder */
    char folder[MAX_FNAME] = {0};
    get_param(qs, "folder", folder, sizeof(folder));
    if (strstr(folder, "..")) {
        send_json(sock, 403, "Forbidden", "{\"error\":\"Invalid folder\"}");
        return;
    }

    /* Build filesystem path and URL path */
    char filepath[MAX_FNAME * 3];
    char url_path[MAX_FNAME * 2];

    if (folder[0]) {
        char dirpath[MAX_FNAME * 2];
        snprintf(dirpath, sizeof(dirpath), "%s%s", UPLOAD_DIR, folder);
        _mkdir(dirpath); /* create if not exists; ignore error if exists */
        snprintf(filepath, sizeof(filepath), "%s%s\\%s",
                 UPLOAD_DIR, folder, filename);
        snprintf(url_path, sizeof(url_path), "/images/%s/%s",
                 folder, filename);
    } else {
        snprintf(filepath, sizeof(filepath), "%s%s", UPLOAD_DIR, filename);
        snprintf(url_path, sizeof(url_path), "/images/%s", filename);
    }

    /* Write the file */
    FILE *fp = fopen(filepath, "wb");
    if (!fp) {
        send_json(sock, 500, "Internal Server Error",
                  "{\"error\":\"Failed to save file\"}");
        return;
    }
    fwrite(body, 1, (size_t)body_size, fp);
    fclose(fp);

    /* Success response */
    char resp[1024];
    snprintf(resp, sizeof(resp),
        "{\"success\":true,\"url\":\"%s\",\"filename\":\"%s\",\"size\":%ld}",
        url_path, filename, body_size);
    send_json(sock, 200, "OK", resp);

    printf("[ADMIN] Uploaded: %s (%ld bytes)\n", filepath, body_size);
}

/* -----------------------------------------------------------------------
 * POST /api/portfolio/save — write the full portfolio JSON to disk.
 * ----------------------------------------------------------------------- */
void handle_admin_save_portfolio(SOCKET sock,
                                 const char *body, long body_size) {
    if (!body || body_size <= 0) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"No data\"}");
        return;
    }

    FILE *fp = fopen(PORTFOLIO_JSON_PATH, "wb");
    if (!fp) {
        send_json(sock, 500, "Internal Server Error",
                  "{\"error\":\"Failed to write portfolio data\"}");
        return;
    }
    fwrite(body, 1, (size_t)body_size, fp);
    fclose(fp);

    send_json(sock, 200, "OK",
              "{\"success\":true,\"message\":\"Portfolio data saved\"}");
    printf("[ADMIN] Portfolio data saved (%ld bytes)\n", body_size);
}

/* -----------------------------------------------------------------------
 * POST /api/upload/delete — delete an image file.
 * Query parameter: filename (required), folder (optional)
 * ----------------------------------------------------------------------- */
void handle_admin_delete_file(SOCKET sock, const char *qs) {
    char filename[MAX_FNAME] = {0};
    if (!get_param(qs, "filename", filename, sizeof(filename)) || !filename[0]) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"Missing filename\"}");
        return;
    }

    /* Security */
    char *sl = strrchr(filename, '/');
    if (sl) memmove(filename, sl + 1, strlen(sl));
    sl = strrchr(filename, '\\');
    if (sl) memmove(filename, sl + 1, strlen(sl));
    if (strstr(filename, "..") || !filename[0]) {
        send_json(sock, 403, "Forbidden", "{\"error\":\"Invalid filename\"}");
        return;
    }

    char folder[MAX_FNAME] = {0};
    get_param(qs, "folder", folder, sizeof(folder));
    if (strstr(folder, "..")) {
        send_json(sock, 403, "Forbidden", "{\"error\":\"Invalid folder\"}");
        return;
    }

    char filepath[MAX_FNAME * 3];
    if (folder[0]) {
        snprintf(filepath, sizeof(filepath), "%s%s\\%s",
                 UPLOAD_DIR, folder, filename);
    } else {
        snprintf(filepath, sizeof(filepath), "%s%s", UPLOAD_DIR, filename);
    }

    if (remove(filepath) == 0) {
        send_json(sock, 200, "OK",
                  "{\"success\":true,\"message\":\"File deleted\"}");
        printf("[ADMIN] Deleted: %s\n", filepath);
    } else {
        send_json(sock, 404, "Not Found",
                  "{\"error\":\"File not found or could not be deleted\"}");
    }
}
