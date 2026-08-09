#ifndef ADMIN_H
#define ADMIN_H

#include <winsock2.h>

/**
 * Check if the HTTP request carries a valid admin token.
 * Looks for the "X-Admin-Token" header and compares its value.
 * Returns 1 if authenticated, 0 otherwise.
 */
int check_admin_auth(const char *request);

/**
 * POST /api/admin/verify
 * Returns 200 if the auth token is valid (checked before calling this).
 */
void handle_admin_verify(SOCKET client_socket);

/**
 * POST /api/upload?filename=xxx[&folder=yyy]
 * Saves the raw binary request body as an image file under public/images/.
 * Optional "folder" query param creates a subdirectory.
 */
void handle_admin_upload(SOCKET client_socket, const char *query_string,
                         const char *body, long body_size);

/**
 * POST /api/portfolio/save
 * Overwrites src/portfolio_data.json with the JSON body content.
 */
void handle_admin_save_portfolio(SOCKET client_socket,
                                 const char *body, long body_size);

/**
 * POST /api/upload/delete?filename=xxx
 * Deletes an image file from public/images/.
 */
void handle_admin_delete_file(SOCKET client_socket, const char *query_string);

#endif /* ADMIN_H */
