/**
 * =========================================================================
 *  Admin API Handlers
 * =========================================================================
 *
 *  Provides endpoints for the admin dashboard:
 *    - bcrypt/SHA-256 authentication via auth.py
 *    - Session token issued on successful login
 *    - Rate limiting (5 failures → 15 min lockout per IP)
 *    - Image file upload (raw binary POST)
 *    - Portfolio JSON save (full overwrite)
 *    - Image file deletion
 * =========================================================================
 */

#include "admin.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <direct.h>
#include <time.h>

/* -----------------------------------------------------------------------
 * Configuration
 * ----------------------------------------------------------------------- */
#define ADMIN_HASH_PATH     "data\\admin_hash.json"
#define SESSION_TOKEN_PATH  "data\\.session_token"
#define PORTFOLIO_JSON_PATH "data\\portfolio_data.json"
#define UPLOAD_DIR          "public\\images\\"
#define MAX_FNAME           256
#define MAX_FAILURES        5
#define LOCKOUT_SECONDS     900  /* 15 minutes */

/* -----------------------------------------------------------------------
 * Rate Limiting
 * ----------------------------------------------------------------------- */
typedef struct { char ip[64]; int failures; time_t last_attempt; } RateEntry;
static RateEntry rate_table[128];
static int rate_count = 0;

static RateEntry *rate_find(const char *ip) {
    for (int i = 0; i < rate_count; i++)
        if (strcmp(rate_table[i].ip, ip) == 0) return &rate_table[i];
    return NULL;
}

static int rate_is_locked(const char *ip) {
    if (!ip) return 0;
    RateEntry *e = rate_find(ip);
    if (!e) return 0;
    if (e->failures >= MAX_FAILURES) {
        if (time(NULL) - e->last_attempt < LOCKOUT_SECONDS) return 1;
        e->failures = 0; /* lockout expired */
    }
    return 0;
}

static void rate_record_fail(const char *ip) {
    if (!ip) return;
    RateEntry *e = rate_find(ip);
    if (!e && rate_count < 128) {
        e = &rate_table[rate_count++];
        strncpy(e->ip, ip, 63); e->ip[63] = '\0';
        e->failures = 0;
    }
    if (e) { e->failures++; e->last_attempt = time(NULL); }
}

static void rate_reset(const char *ip) {
    if (!ip) return;
    RateEntry *e = rate_find(ip);
    if (e) e->failures = 0;
}

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
            dst[i++] = ' '; src++;
        } else {
            dst[i++] = *src++;
        }
    }
    dst[i] = '\0';
}

/* -----------------------------------------------------------------------
 * Helper: extract a query parameter value (URL-decoded).
 * ----------------------------------------------------------------------- */
static int get_param(const char *qs, const char *key, char *out, size_t max) {
    if (!qs || !key) return 0;
    size_t klen = strlen(key);
    const char *p = qs;
    while (*p) {
        if (strncmp(p, key, klen) == 0 && p[klen] == '=') {
            const char *vs = p + klen + 1;
            const char *ve = strchr(vs, '&');
            size_t vlen = ve ? (size_t)(ve - vs) : strlen(vs);
            char raw[MAX_FNAME];
            if (vlen >= sizeof(raw)) vlen = sizeof(raw) - 1;
            memcpy(raw, vs, vlen); raw[vlen] = '\0';
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
 * Helper: read the saved session token.
 * ----------------------------------------------------------------------- */
static void load_session_token(char *out, size_t max) {
    out[0] = '\0';
    FILE *fp = fopen(SESSION_TOKEN_PATH, "r");
    if (!fp) return;
    if (fgets(out, (int)max, fp)) {
        size_t len = strlen(out);
        while (len > 0 && (out[len-1] == '\r' || out[len-1] == '\n')) out[--len] = '\0';
    }
    fclose(fp);
}

/* -----------------------------------------------------------------------
 * Helper: save a new session token.
 * ----------------------------------------------------------------------- */
static void save_session_token(const char *tok) {
    FILE *fp = fopen(SESSION_TOKEN_PATH, "w");
    if (fp) { fputs(tok, fp); fclose(fp); }
}

/* -----------------------------------------------------------------------
 * check_admin_auth — verify X-Admin-Token header against session token.
 * ----------------------------------------------------------------------- */
int check_admin_auth(const char *request) {
    const char *pos = strstr(request, "X-Admin-Token:");
    if (!pos) pos = strstr(request, "x-admin-token:");
    if (!pos) return 0;
    pos += 14;
    while (*pos == ' ') pos++;

    char stored[128] = {0};
    load_session_token(stored, sizeof(stored));
    if (!stored[0]) return 0;

    size_t tlen = strlen(stored);
    if (strncmp(pos, stored, tlen) == 0) {
        char c = pos[tlen];
        if (c == '\r' || c == '\n' || c == '\0' || c == ' ') return 1;
    }
    return 0;
}

/* -----------------------------------------------------------------------
 * POST /api/admin/verify
 * Reads the plain password from X-Admin-Token, delegates to auth.py,
 * issues a session token on success.
 * ----------------------------------------------------------------------- */
void handle_admin_verify(SOCKET sock, const char *request, const char *client_ip) {
    if (rate_is_locked(client_ip)) {
        send_json(sock, 429, "Too Many Requests",
                  "{\"error\":\"Too many failed attempts. Try again in 15 minutes.\"}");
        return;
    }

    /* Extract the submitted password from the header */
    const char *pos = strstr(request, "X-Admin-Token:");
    if (!pos) pos = strstr(request, "x-admin-token:");
    char password[128] = {0};
    if (pos) {
        pos += 14;
        while (*pos == ' ') pos++;
        size_t i = 0;
        while (pos[i] && pos[i] != '\r' && pos[i] != '\n' && i < 127) {
            password[i] = pos[i];
            i++;
        }
        password[i] = '\0';
    }

    if (!password[0]) {
        send_json(sock, 401, "Unauthorized", "{\"error\":\"No password provided\"}");
        return;
    }

    /* Delegate verification to auth.py (handles SHA-256 / bcrypt fallback) */
    char cmd[512];
    snprintf(cmd, sizeof(cmd), "python auth.py verify \"%s\"", password);
    int rc = system(cmd);

    if (rc == 0) {
        rate_reset(client_ip);
        /* Issue a fresh session token */
        char tok[64];
        snprintf(tok, sizeof(tok), "sess_%u%u", (unsigned)rand(), (unsigned)time(NULL));
        save_session_token(tok);
        char resp[128];
        snprintf(resp, sizeof(resp),
                 "{\"authenticated\":true,\"session_token\":\"%s\"}", tok);
        send_json(sock, 200, "OK", resp);
    } else {
        rate_record_fail(client_ip);
        send_json(sock, 401, "Unauthorized", "{\"error\":\"Invalid password\"}");
    }
}

/* -----------------------------------------------------------------------
 * POST /api/admin/password — change the admin password.
 * Body: plain-text new password.
 * Delegates hashing + saving to auth.py (updates data/admin_hash.json).
 * ----------------------------------------------------------------------- */
void handle_admin_change_password(SOCKET sock, const char *body, long body_size) {
    if (!body || body_size <= 0) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"No password provided\"}");
        return;
    }

    char new_pass[128] = {0};
    size_t to_copy = (size_t)body_size < sizeof(new_pass) - 1
                     ? (size_t)body_size : sizeof(new_pass) - 1;
    memcpy(new_pass, body, to_copy);

    /* Strip surrounding quotes if the body was sent as a JSON string */
    if (to_copy >= 2 && new_pass[0] == '"' && new_pass[to_copy-1] == '"') {
        memmove(new_pass, new_pass + 1, to_copy - 2);
        to_copy -= 2; new_pass[to_copy] = '\0';
    }
    /* Trim trailing whitespace */
    while (to_copy > 0 &&
           (new_pass[to_copy-1] == '\r' || new_pass[to_copy-1] == '\n' ||
            new_pass[to_copy-1] == ' ')) {
        new_pass[--to_copy] = '\0';
    }

    /* auth.py hash <pass>  →  writes data/admin_hash.json, prints hash */
    char cmd[512];
    snprintf(cmd, sizeof(cmd), "python auth.py hash \"%s\"", new_pass);
    int rc = system(cmd);

    if (rc != 0) {
        send_json(sock, 500, "Internal Server Error",
                  "{\"error\":\"Failed to hash password\"}");
        return;
    }

    /* Invalidate current session so user must log in again */
    remove(SESSION_TOKEN_PATH);
    send_json(sock, 200, "OK",
              "{\"success\":true,\"message\":\"Password updated. Please log in again.\"}");
    printf("[ADMIN] Password changed — session invalidated.\n");
}

/* -----------------------------------------------------------------------
 * POST /api/admin/forgot — trigger Python script to send reset email.
 * NO AUTH REQUIRED.
 * ----------------------------------------------------------------------- */
void handle_admin_forgot_password(SOCKET sock) {
    printf("[ADMIN] Triggering password reset email script...\n");
    int res = system("python send_reset.py");
    if (res == 0) {
        send_json(sock, 200, "OK", "{\"success\":true,\"message\":\"Reset email sent\"}");
    } else {
        send_json(sock, 500, "Internal Server Error",
                  "{\"error\":\"Failed to send email. Check configuration.\"}");
    }
}

/* -----------------------------------------------------------------------
 * POST /api/upload — save uploaded image file.
 * Query parameters: filename (required), folder (optional)
 * ----------------------------------------------------------------------- */
void handle_admin_upload(SOCKET sock, const char *qs,
                         const char *body, long body_size) {
    if (!body || body_size <= 0) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"No file data\"}");
        return;
    }

    char filename[MAX_FNAME] = {0};
    if (!get_param(qs, "filename", filename, sizeof(filename)) || !filename[0]) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"Missing filename\"}");
        return;
    }

    /* Security: strip directory components */
    char *s = strrchr(filename, '/');
    if (s) memmove(filename, s + 1, strlen(s));
    s = strrchr(filename, '\\');
    if (s) memmove(filename, s + 1, strlen(s));
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
    char url_path[MAX_FNAME * 2];

    if (folder[0]) {
        char dirpath[MAX_FNAME * 2];
        snprintf(dirpath, sizeof(dirpath), "%s%s", UPLOAD_DIR, folder);
        _mkdir(dirpath);
        snprintf(filepath, sizeof(filepath), "%s%s\\%s", UPLOAD_DIR, folder, filename);
        snprintf(url_path, sizeof(url_path), "/images/%s/%s", folder, filename);
    } else {
        snprintf(filepath, sizeof(filepath), "%s%s", UPLOAD_DIR, filename);
        snprintf(url_path, sizeof(url_path), "/images/%s", filename);
    }

    FILE *fp = fopen(filepath, "wb");
    if (!fp) {
        send_json(sock, 500, "Internal Server Error", "{\"error\":\"Failed to save file\"}");
        return;
    }
    fwrite(body, 1, (size_t)body_size, fp);
    fclose(fp);

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
 * ----------------------------------------------------------------------- */
void handle_admin_delete_file(SOCKET sock, const char *qs) {
    char filename[MAX_FNAME] = {0};
    if (!get_param(qs, "filename", filename, sizeof(filename)) || !filename[0]) {
        send_json(sock, 400, "Bad Request", "{\"error\":\"Missing filename\"}");
        return;
    }

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
    if (folder[0])
        snprintf(filepath, sizeof(filepath), "%s%s\\%s", UPLOAD_DIR, folder, filename);
    else
        snprintf(filepath, sizeof(filepath), "%s%s", UPLOAD_DIR, filename);

    if (remove(filepath) == 0) {
        send_json(sock, 200, "OK", "{\"success\":true,\"message\":\"File deleted\"}");
        printf("[ADMIN] Deleted: %s\n", filepath);
    } else {
        send_json(sock, 404, "Not Found",
                  "{\"error\":\"File not found or could not be deleted\"}");
    }
}
