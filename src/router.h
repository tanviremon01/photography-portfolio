#ifndef ROUTER_H
#define ROUTER_H

#include <winsock2.h>

/**
 * Handles an incoming HTTP request by routing it to the appropriate handler.
 *
 * Routes:
 *   GET /api/portfolio       -> JSON API (api.c)
 *   GET /                    -> serves public/index.html
 *   GET /css/..., /js/..., etc. -> serves static files from public/
 *
 * @param client_socket  The connected client socket.
 * @param request        The raw HTTP request string.
 * @param request_len    Length of the request string.
 */
void route_request(SOCKET client_socket, const char *request, int request_len);

#endif /* ROUTER_H */
