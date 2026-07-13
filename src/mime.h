#ifndef MIME_H
#define MIME_H

/**
 * Returns the MIME type string for the given file extension.
 * Example: get_mime_type(".css") -> "text/css"
 * Returns "application/octet-stream" for unknown extensions.
 */
const char *get_mime_type(const char *extension);

#endif /* MIME_H */
