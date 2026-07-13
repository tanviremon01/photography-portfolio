#include "mime.h"
#include <string.h>

/**
 * MIME type lookup table.
 * Maps file extensions to their corresponding MIME types.
 * Add new entries here to support additional file types.
 */
typedef struct {
    const char *extension;
    const char *mime_type;
} MimeEntry;

static const MimeEntry MIME_TABLE[] = {
    { ".html", "text/html" },
    { ".htm",  "text/html" },
    { ".css",  "text/css" },
    { ".js",   "application/javascript" },
    { ".json", "application/json" },
    { ".jpg",  "image/jpeg" },
    { ".jpeg", "image/jpeg" },
    { ".png",  "image/png" },
    { ".gif",  "image/gif" },
    { ".webp", "image/webp" },
    { ".svg",  "image/svg+xml" },
    { ".ico",  "image/x-icon" },
    { ".woff", "font/woff" },
    { ".woff2","font/woff2" },
    { ".ttf",  "font/ttf" },
    { ".txt",  "text/plain" },
    { ".xml",  "application/xml" },
    { NULL,    NULL }
};

const char *get_mime_type(const char *extension) {
    if (!extension) {
        return "application/octet-stream";
    }

    for (int i = 0; MIME_TABLE[i].extension != NULL; i++) {
        if (_stricmp(extension, MIME_TABLE[i].extension) == 0) {
            return MIME_TABLE[i].mime_type;
        }
    }

    return "application/octet-stream";
}
