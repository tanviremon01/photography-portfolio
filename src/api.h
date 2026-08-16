#ifndef API_H
#define API_H

#include <winsock2.h>

/**
 * Handles the /api/portfolio endpoint.
 * Reads portfolio_data.json from disk and sends it as a JSON response.
 * Supports optional ?category= query parameter for filtering.
 * Compresses the response with gzip if the client sends Accept-Encoding: gzip.
 *
 * @param client_socket  The connected client socket to write the response to.
 * @param query_string   The query string portion of the URL (after '?'), or NULL.
 * @param request        The full raw HTTP request (for Accept-Encoding detection).
 */
void handle_api_portfolio(SOCKET client_socket, const char *query_string,
                          const char *request);

#endif /* API_H */
