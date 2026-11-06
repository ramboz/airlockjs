#define main google_guard_service_main
#include "inspected-google-reject-guard.c"
#undef main

static int check_descriptor(int sharing) {
  int fd = socket(AF_INET, SOCK_STREAM, 0), observed = -1;
  int reuseaddr = -1, reuseport = -1;
  socklen_t length = sizeof(observed);
  struct sockaddr_in address = { .sin_len = sizeof(address), .sin_family = AF_INET,
    .sin_addr.s_addr = htonl(INADDR_LOOPBACK) };
  if (fd < 0 || setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &sharing, sizeof(sharing)) != 0
      || getsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &observed, &length) != 0 || !!observed != sharing
      || bind(fd, (struct sockaddr *)&address, sizeof(address)) != 0 || listen(fd, 1) != 0) {
    perror("fixture_setup_failed");
    if (fd >= 0) close(fd);
    return 0;
  }
  length = sizeof(address);
  if (getsockname(fd, (struct sockaddr *)&address, &length) != 0) {
    perror("fixture_getsockname_failed");
    close(fd);
    return 0;
  }
  int port = ntohs(address.sin_port);
  int valid = validate_port_sharing(fd, &reuseport);
  errno = 0;
  int full = validate_listener(fd, port, &reuseaddr, &reuseport), full_errno = errno;
  printf("descriptor address=127.0.0.1 port=%d type=stream actual_reuseport=%d validator_reuseport=%d policy_accepted=%d expected=%d full_accepted=%d full_errno=%d\n",
         port, !!observed, !!reuseport, valid, !sharing, full, full_errno);
  close(fd);
  return valid == !sharing && (!sharing || !full);
}

int main(void) {
  int nonsharing = check_descriptor(0);
  int sharing = check_descriptor(1);
  return nonsharing && sharing ? 0 : 1;
}
