#include "api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* -----------------------------------------------------------------------
 * Path to the portfolio data JSON file (relative to the executable).
 * Change this if you move the JSON file to a different location.
 * ----------------------------------------------------------------------- */
#define PORTFOLIO_JSON_PATH "src\\portfolio_data.json"

/* Maximum size for the JSON file (4 MB should be plenty) */
#define MAX_JSON_SIZE (4 * 1024 * 1024)

/* -----------------------------------------------------------------------
 * Fallback JSON returned when portfolio_data.json is missing or unreadable.
 * ----------------------------------------------------------------------- */
static const char *FALLBACK_JSON =
    "{"
    "\"site\":{\"title\":\"Lens & Light\",\"tagline\":\"Portfolio data file not found\","
    "\"author\":\"Photographer\",\"bio\":\"Please create src/portfolio_data.json\","
    "\"contact_email\":\"hello@example.com\",\"social\":{\"instagram\":\"#\",\"twitter\":\"#\"}},"
    "\"categories\":[\"All\"],"
    "\"photos\":[]"
    "}";

/* -----------------------------------------------------------------------
 * Helper: read the entire contents of a file into a malloc'd buffer.
 * Returns NULL on failure. Caller must free() the returned pointer.
 * ----------------------------------------------------------------------- */
static char *read_file_contents(const char *path, long *out_size) {
    FILE *fp = fopen(path, "rb");
    if (!fp) return NULL;

    fseek(fp, 0, SEEK_END);
    long size = ftell(fp);
    fseek(fp, 0, SEEK_SET);

    if (size <= 0 || size > MAX_JSON_SIZE) {
        fclose(fp);
        return NULL;
    }

    char *buffer = (char *)malloc((size_t)size + 1);
    if (!buffer) {
        fclose(fp);
        return NULL;
    }

    size_t read_count = fread(buffer, 1, (size_t)size, fp);
    fclose(fp);

    buffer[read_count] = '\0';
    if (out_size) *out_size = (long)read_count;

    return buffer;
}

/* -----------------------------------------------------------------------
 * Helper: extract the value of a query parameter from a query string.
 * Example: parse_query_param("category=Landscape&page=1", "category", buf, 64)
 *          writes "Landscape" into buf.
 * Returns 1 on success, 0 if not found.
 * ----------------------------------------------------------------------- */
static int parse_query_param(const char *query, const char *key,
                             char *value_out, size_t value_max) {
    if (!query || !key) return 0;

    size_t key_len = strlen(key);
    const char *p = query;

    while (*p) {
        /* Check if this position starts with "key=" */
        if (strncmp(p, key, key_len) == 0 && p[key_len] == '=') {
            const char *val_start = p + key_len + 1;
            const char *val_end = strchr(val_start, '&');
            size_t val_len = val_end ? (size_t)(val_end - val_start)
                                     : strlen(val_start);
            if (val_len >= value_max) val_len = value_max - 1;
            memcpy(value_out, val_start, val_len);
            value_out[val_len] = '\0';
            return 1;
        }
        /* Advance to the next parameter */
        const char *amp = strchr(p, '&');
        if (!amp) break;
        p = amp + 1;
    }
    return 0;
}

/* -----------------------------------------------------------------------
 * Helper: a minimal in-memory JSON filter.
 * When ?category=X is provided, we rebuild the JSON keeping only photos
 * whose "category" field matches X.
 *
 * Because we avoid external JSON libraries, this uses simple string
 * scanning. It works reliably with the known structure of portfolio_data.json.
 * ----------------------------------------------------------------------- */
static char *filter_by_category(const char *json, const char *category) {
    /* If category is "All" or empty, return the original JSON */
    if (!category || strlen(category) == 0 ||
        _stricmp(category, "All") == 0) {
        return NULL; /* signal: no filtering needed */
    }

    /* Strategy: find the "photos" array, then iterate over each object
     * and include only those whose "category" value matches. */
    const char *photos_key = "\"photos\"";
    const char *photos_start = strstr(json, photos_key);
    if (!photos_start) return NULL;

    /* Find the opening '[' of the photos array */
    const char *arr_start = strchr(photos_start, '[');
    if (!arr_start) return NULL;

    /* Find the matching ']' — count nested braces */
    const char *p = arr_start + 1;
    int depth = 1;
    const char *arr_end = NULL;
    while (*p && depth > 0) {
        if (*p == '[') depth++;
        else if (*p == ']') { depth--; if (depth == 0) { arr_end = p; break; } }
        p++;
    }
    if (!arr_end) return NULL;

    /* Build a new JSON string with prefix + filtered photos + suffix */
    size_t json_len = strlen(json);
    char *result = (char *)malloc(json_len + 256);
    if (!result) return NULL;

    /* Copy everything before the '[' */
    size_t prefix_len = (size_t)(arr_start - json) + 1; /* include '[' */
    memcpy(result, json, prefix_len);
    size_t out_pos = prefix_len;

    /* Iterate over photo objects inside the array */
    p = arr_start + 1;
    int first = 1;
    while (p < arr_end) {
        /* Skip whitespace and commas */
        while (p < arr_end && (*p == ' ' || *p == '\t' || *p == '\n' ||
               *p == '\r' || *p == ','))
            p++;
        if (p >= arr_end || *p != '{') break;

        /* Find the matching '}' for this object */
        const char *obj_start = p;
        int obj_depth = 1;
        p++;
        while (p < arr_end && obj_depth > 0) {
            if (*p == '{') obj_depth++;
            else if (*p == '}') obj_depth--;
            p++;
        }
        const char *obj_end = p; /* one past '}' */

        /* Check if this object's "category" matches */
        size_t obj_len = (size_t)(obj_end - obj_start);
        char cat_search[256];
        snprintf(cat_search, sizeof(cat_search), "\"category\":\"%s\"", category);
        /* Also try with spaces around colon */
        char cat_search2[256];
        snprintf(cat_search2, sizeof(cat_search2), "\"category\": \"%s\"", category);

        char *obj_copy = (char *)malloc(obj_len + 1);
        memcpy(obj_copy, obj_start, obj_len);
        obj_copy[obj_len] = '\0';

        if (strstr(obj_copy, cat_search) || strstr(obj_copy, cat_search2)) {
            if (!first) {
                result[out_pos++] = ',';
            }
            memcpy(result + out_pos, obj_start, obj_len);
            out_pos += obj_len;
            first = 0;
        }
        free(obj_copy);
    }

    /* Close the array and copy the suffix (everything after ']') */
    result[out_pos++] = ']';
    size_t suffix_start = (size_t)(arr_end - json) + 1;
    size_t suffix_len = json_len - suffix_start;
    memcpy(result + out_pos, json + suffix_start, suffix_len);
    out_pos += suffix_len;
    result[out_pos] = '\0';

    return result;
}

/* -----------------------------------------------------------------------
 * Main API handler: reads the JSON file, optionally filters, and responds.
 * ----------------------------------------------------------------------- */
void handle_api_portfolio(SOCKET client_socket, const char *query_string) {
    long json_size = 0;
    char *json_data = read_file_contents(PORTFOLIO_JSON_PATH, &json_size);

    const char *response_body;
    char *filtered = NULL;
    int need_free_body = 0;

    if (!json_data) {
        /* File not found — use fallback */
        response_body = FALLBACK_JSON;
    } else {
        /* Check for category filter */
        char category[128] = {0};
        if (parse_query_param(query_string, "category", category, sizeof(category))) {
            filtered = filter_by_category(json_data, category);
        }

        if (filtered) {
            response_body = filtered;
            need_free_body = 0; /* we'll free filtered separately */
        } else {
            response_body = json_data;
        }
    }

    /* Build HTTP response */
    size_t body_len = strlen(response_body);
    char header[512];
    int header_len = snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Cache-Control: no-cache\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "\r\n",
        body_len);

    send(client_socket, header, header_len, 0);
    send(client_socket, response_body, (int)body_len, 0);

    /* Cleanup */
    if (filtered) free(filtered);
    if (json_data) free(json_data);
    (void)need_free_body;
}
