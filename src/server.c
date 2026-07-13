/**
 * =========================================================================
 *  Lens & Light — Photography Portfolio HTTP Server
 * =========================================================================
 *
 *  A lightweight, single-threaded HTTP server for Windows using Winsock2.
 *  Serves static files from the public/ directory and provides a JSON API
 *  endpoint at /api/portfolio for dynamic portfolio data.
 *
 *  Compile:  gcc -o server.exe src/server.c src/router.c src/api.c src/mime.c -lws2_32
 *  Run:      server.exe
 *  Browse:   http://localhost:8080
 *
 *  Press Ctrl+C to stop the server.
 * =========================================================================
 */

#include <winsock2.h>
#include <ws2tcpip.h>
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include "router.h"

/* Link with -lws2_32 when compiling with GCC */

/* -----------------------------------------------------------------------
 * Configuration — change these to customize the server.
 * ----------------------------------------------------------------------- */
#define SERVER_PORT     8080
#define SERVER_ADDR     "127.0.0.1"
#define BACKLOG         10
#define RECV_BUFFER     8192

/* -----------------------------------------------------------------------
 * Global state for clean shutdown.
 * ----------------------------------------------------------------------- */
static volatile int g_running = 1;
static SOCKET g_listen_socket = INVALID_SOCKET;

/**
 * Signal handler for Ctrl+C — triggers graceful shutdown.
 */
static void handle_signal(int sig) {
    (void)sig;
    printf("\n[SERVER] Shutting down...\n");
    g_running = 0;
    /* Close the listening socket to unblock accept() */
    if (g_listen_socket != INVALID_SOCKET) {
        closesocket(g_listen_socket);
        g_listen_socket = INVALID_SOCKET;
    }
}

/**
 * Initializes Winsock, creates and binds the listening socket.
 * Returns the listening socket on success, or INVALID_SOCKET on failure.
 */
static SOCKET create_server_socket(void) {
    WSADATA wsa_data;
    int result = WSAStartup(MAKEWORD(2, 2), &wsa_data);
    if (result != 0) {
        fprintf(stderr, "[ERROR] WSAStartup failed: %d\n", result);
        return INVALID_SOCKET;
    }

    SOCKET listen_sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listen_sock == INVALID_SOCKET) {
        fprintf(stderr, "[ERROR] socket() failed: %d\n", WSAGetLastError());
        WSACleanup();
        return INVALID_SOCKET;
    }

    /* Allow port reuse to avoid "Address already in use" on restart */
    int opt = 1;
    setsockopt(listen_sock, SOL_SOCKET, SO_REUSEADDR,
               (const char *)&opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(SERVER_PORT);
    addr.sin_addr.s_addr = inet_addr(SERVER_ADDR);

    if (bind(listen_sock, (struct sockaddr *)&addr, sizeof(addr)) == SOCKET_ERROR) {
        fprintf(stderr, "[ERROR] bind() failed: %d\n", WSAGetLastError());
        fprintf(stderr, "        Is port %d already in use?\n", SERVER_PORT);
        closesocket(listen_sock);
        WSACleanup();
        return INVALID_SOCKET;
    }

    if (listen(listen_sock, BACKLOG) == SOCKET_ERROR) {
        fprintf(stderr, "[ERROR] listen() failed: %d\n", WSAGetLastError());
        closesocket(listen_sock);
        WSACleanup();
        return INVALID_SOCKET;
    }

    return listen_sock;
}

/**
 * Main server loop: accepts connections and dispatches to the router.
 */
int main(void) {
    /* Register Ctrl+C handler */
    signal(SIGINT, handle_signal);

    printf("=========================================\n");
    printf("  Lens & Light — Portfolio Server\n");
    printf("=========================================\n");

    g_listen_socket = create_server_socket();
    if (g_listen_socket == INVALID_SOCKET) {
        return 1;
    }

    printf("[SERVER] Listening on http://%s:%d\n", SERVER_ADDR, SERVER_PORT);
    printf("[SERVER] Press Ctrl+C to stop.\n\n");

    while (g_running) {
        struct sockaddr_in client_addr;
        int client_addr_len = sizeof(client_addr);

        SOCKET client_socket = accept(g_listen_socket,
                                       (struct sockaddr *)&client_addr,
                                       &client_addr_len);

        if (client_socket == INVALID_SOCKET) {
            if (!g_running) break; /* Shutdown triggered */
            fprintf(stderr, "[WARN] accept() failed: %d\n", WSAGetLastError());
            continue;
        }

        /* Read the HTTP request */
        char buffer[RECV_BUFFER];
        int bytes_received = recv(client_socket, buffer, sizeof(buffer) - 1, 0);

        if (bytes_received > 0) {
            buffer[bytes_received] = '\0';
            route_request(client_socket, buffer, bytes_received);
        }

        /* Close the client connection */
        shutdown(client_socket, SD_SEND);
        closesocket(client_socket);
    }

    /* Cleanup */
    if (g_listen_socket != INVALID_SOCKET) {
        closesocket(g_listen_socket);
    }
    WSACleanup();

    printf("[SERVER] Goodbye.\n");
    return 0;
}
