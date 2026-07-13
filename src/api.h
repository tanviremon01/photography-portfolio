#ifndef API_H
#define API_H

#include <winsock2.h>

/**
 * Handles the /api/portfolio endpoint.
 * Reads portfolio_data.json from disk and sends it as a JSON response.
 * Supports optional ?category= query parameter for filtering.
 *
 * @param client_socket  The connected client socket to write the response to.
 * @param query_string   The query string portion of the URL (after '?'), or NULL.
 */
void handle_api_portfolio(SOCKET client_socket, const char *query_string);

#endif /* API_H */
