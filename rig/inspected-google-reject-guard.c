#include <arpa/inet.h>
#include <errno.h>
#include <launch.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/socket.h>
#include <unistd.h>

static int validate_port_sharing(int fd, int *reuseport) {
  socklen_t option_len = sizeof(*reuseport);
  return getsockopt(fd, SOL_SOCKET, SO_REUSEPORT, reuseport, &option_len) == 0 && *reuseport == 0;
}

static int validate_listener(int fd, long port, int *reuseaddr, int *reuseport) {
  int type = 0, accepting = 0;
  struct sockaddr_in address = {0};
  socklen_t address_len = sizeof(address), option_len = sizeof(type);
  return getsockname(fd, (struct sockaddr *)&address, &address_len) == 0
      && address_len == sizeof(address) && address.sin_family == AF_INET
      && ntohl(address.sin_addr.s_addr) == INADDR_LOOPBACK && ntohs(address.sin_port) == port
      && getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &option_len) == 0 && type == SOCK_STREAM
      && validate_port_sharing(fd, reuseport)
      && (option_len = sizeof(accepting),
          getsockopt(fd, SOL_SOCKET, SO_ACCEPTCONN, &accepting, &option_len) == 0) && accepting
      && (option_len = sizeof(*reuseaddr),
          getsockopt(fd, SOL_SOCKET, SO_REUSEADDR, reuseaddr, &option_len) == 0);
}

int main(int argc, char **argv) {
  char *end;
  if (argc != 2) {
    fprintf(stderr, "unavailable invalid_port\n");
    return 2;
  }
  errno = 0;
  long port = strtol(argv[1], &end, 10);
  if (errno || *end || port < 1 || port > 65535) {
    fprintf(stderr, "unavailable invalid_port\n");
    return 2;
  }
  int *fds = NULL;
  size_t count = 0;
  int error = launch_activate_socket("Reject", &fds, &count);
  if (error != 0) {
    fprintf(stderr, "unavailable activation_error=%d\n", error);
    return 1;
  }
  if (count != 1) {
    fprintf(stderr, "unavailable descriptor_count=%zu\n", count);
    free(fds);
    return 1;
  }
  int fd = fds[0], reuseaddr = 0, reuseport = 0;
  if (!validate_listener(fd, port, &reuseaddr, &reuseport)) {
    fprintf(stderr, "unavailable invalid_descriptor\n");
    free(fds);
    return 1;
  }
  free(fds);
  printf("ready pid=%ld family=IPv4 address=127.0.0.1 port=%ld type=stream accepting=%d reuseaddr=%d reuseport=%d\n",
         (long)getpid(), port, 1, reuseaddr, reuseport);
  fflush(stdout);
  for (;;) {
    int client = accept(fd, NULL, NULL);
    if (client < 0) {
      if (errno == EINTR) continue;
      fprintf(stderr, "unavailable accept_error=%d\n", errno);
      return 1;
    }
    close(client);
  }
}
