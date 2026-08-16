#ifndef API_H
#define API_H

#include <winsock2.h>

/**
 * Validates the portfolio JSON file at startup.
 * Checks that the file is readable and contains required keys
 * ("site", "photos", "categories") with correct types.
 * Prints [WARN] messages to stderr for each problem found.
 *
 * Returns 1 if valid, 0 if any check fails.
 * The server continues running regardless — the API falls back to
 * embedded fallback JSON when the file is missing or corrupt.
 */
int validate_portfolio_json(void);

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
