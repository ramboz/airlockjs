#include <errno.h>
#include <poll.h>
#include <unistd.h>

static int witness_listener = -1, witness_notice = -1;
static int witness_poll(struct pollfd *fds, nfds_t count, int timeout) {
  if (witness_notice >= 0 && count == 1 && fds[0].fd == witness_listener && timeout == -1) {
    /* A real empty kernel wait completes before the parent may connect. */
    int observed;
    do { observed = poll(fds, count, 150); } while (observed < 0 && errno == EINTR);
    if (observed != 0 || write(witness_notice, "W", 1) != 1) return -1;
    witness_notice = -1;
  }
  return poll(fds, count, timeout);
}

#define poll witness_poll
#define main google_guard_service_main
#include "inspected-google-reject-guard.c"
#undef main
#undef poll
#include <fcntl.h>
#include <signal.h>
#include <sys/time.h>
#include <sys/wait.h>

static int check_descriptor(const char *name, int sharing, int listening, int datagram,
                            int nonblocking, int wrong_port, int expected) {
  int fd = socket(AF_INET, datagram ? SOCK_DGRAM : SOCK_STREAM, 0), observed = -1;
  int reuseaddr = -1, reuseport = -1;
  socklen_t length = sizeof(observed);
  struct sockaddr_in address = { .sin_len = sizeof(address), .sin_family = AF_INET,
    .sin_addr.s_addr = htonl(INADDR_LOOPBACK) };
  if (fd < 0 || setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &sharing, sizeof(sharing)) != 0
      || getsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &observed, &length) != 0 || !!observed != sharing
      || bind(fd, (struct sockaddr *)&address, sizeof(address)) != 0
      || (listening && listen(fd, 1) != 0)
      || (nonblocking && fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK) != 0)) {
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
  int candidate = wrong_port ? (port == 65535 ? port - 1 : port + 1) : port;
  int before = fcntl(fd, F_GETFL);
  errno = 0;
  int full = validate_listener(fd, candidate, &reuseaddr, &reuseport), full_errno = errno;
  int after = fcntl(fd, F_GETFL);
  printf("case=%s port=%d expected_port=%d reuseport=%d accepted=%d expected=%d errno=%d flags_unchanged=%d\n",
         name, port, candidate, !!observed, full, expected, full_errno, before >= 0 && before == after);
  close(fd);
  return full == expected && before >= 0 && before == after;
}

static int check_wrong_address(void) {
  int fd = socket(AF_INET, SOCK_STREAM, 0), reuseaddr = -1, reuseport = -1;
  if (fd < 0) { perror("fixture_setup_failed"); return 0; }
  struct sockaddr_in address = {0};
  socklen_t length = sizeof(address);
  if (getsockname(fd, (struct sockaddr *)&address, &length) != 0
      || ntohl(address.sin_addr.s_addr) != INADDR_ANY || ntohs(address.sin_port) != 0) {
    perror("fixture_getsockname_failed");
    close(fd);
    return 0;
  }
  errno = 0;
  int full = validate_listener(fd, 0, &reuseaddr, &reuseport), full_errno = errno;
  printf("case=wrong-address-unbound port=0 expected_port=0 reuseport=0 accepted=%d expected=0 errno=%d\n",
         full, full_errno);
  close(fd);
  return !full;
}

static int check_wrong_family(void) {
  int fd = socket(AF_INET6, SOCK_STREAM, 0), reuseaddr = -1, reuseport = -1;
  if (fd < 0) {
    if (errno == EAFNOSUPPORT || errno == EPROTONOSUPPORT) {
      printf("case=wrong-family skip_errno=%d\n", errno);
      return 1;
    }
    perror("fixture_ipv6_socket_failed");
    return 0;
  }
  struct sockaddr_in6 address = { .sin6_len = sizeof(address), .sin6_family = AF_INET6,
    .sin6_addr = IN6ADDR_LOOPBACK_INIT };
  if (bind(fd, (struct sockaddr *)&address, sizeof(address)) != 0) {
    int error = errno;
    close(fd);
    if (error == EADDRNOTAVAIL || error == EAFNOSUPPORT) {
      printf("case=wrong-family skip_errno=%d\n", error);
      return 1;
    }
    errno = error;
    perror("fixture_ipv6_bind_failed");
    return 0;
  }
  socklen_t length = sizeof(address);
  if (listen(fd, 1) != 0 || getsockname(fd, (struct sockaddr *)&address, &length) != 0) {
    perror("fixture_ipv6_setup_failed");
    close(fd);
    return 0;
  }
  int full = validate_listener(fd, ntohs(address.sin6_port), &reuseaddr, &reuseport);
  printf("case=wrong-family actual=::1 listening=1 accepted=%d expected=0\n", full);
  close(fd);
  return !full;
}

static int check_connected_or_queued(int queued) {
  int listener = socket(AF_INET, SOCK_STREAM, 0), client = -1, reuseaddr = -1, reuseport = -1;
  struct sockaddr_in address = { .sin_len = sizeof(address), .sin_family = AF_INET,
    .sin_addr.s_addr = htonl(INADDR_LOOPBACK) };
  socklen_t length = sizeof(address);
  if (listener < 0 || bind(listener, (struct sockaddr *)&address, sizeof(address)) != 0
      || listen(listener, 1) != 0 || getsockname(listener, (struct sockaddr *)&address, &length) != 0
      || (client = socket(AF_INET, SOCK_STREAM, 0)) < 0
      || connect(client, (struct sockaddr *)&address, sizeof(address)) != 0) {
    perror("fixture_connection_failed");
    if (client >= 0) close(client);
    if (listener >= 0) close(listener);
    return 0;
  }
  int fd = queued ? listener : client;
  int flags = fcntl(fd, F_GETFL);
  if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK) != 0) {
    perror("fixture_nonblocking_failed");
    close(client);
    close(listener);
    return 0;
  }
  flags = fcntl(fd, F_GETFL);
  struct sockaddr_in local = {0};
  length = sizeof(local);
  if (getsockname(fd, (struct sockaddr *)&local, &length) != 0) {
    perror("fixture_getsockname_failed");
    close(client);
    close(listener);
    return 0;
  }
  if (queued) {
    struct pollfd ready = { .fd = listener, .events = POLLIN };
    if (poll(&ready, 1, 5000) != 1 || !(ready.revents & POLLIN)) {
      fprintf(stderr, "fixture_queue_not_observed\n");
      close(client);
      close(listener);
      return 0;
    }
  }
  int valid = queued == 2 ? reject_next(fd) == 0 : validate_listener(fd, ntohs(local.sin_port), &reuseaddr, &reuseport);
  int same_flags = flags >= 0 && fcntl(fd, F_GETFL) == flags;
  int rejected = 0;
  if (queued && valid) {
    struct timeval timeout = { .tv_sec = 2 };
    if (setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout)) == 0) {
      char byte;
      ssize_t n = recv(client, &byte, 1, 0);
      rejected = n == 0 || (n < 0 && errno == ECONNRESET);
    }
  }
  printf("case=%s accepted=%d expected=%d flags_unchanged=%d queued_rejected=%d\n",
         queued == 2 ? "service-reject" : queued ? "queued-listener" : "connected",
         valid, !!queued, same_flags, rejected);
  close(client);
  close(listener);
  return valid == !!queued && same_flags && (!queued || rejected);
}

static int wait_notice(int fd, char expected) {
  struct pollfd ready = { .fd = fd, .events = POLLIN };
  int result;
  do { result = witness_poll(&ready, 1, 2000); } while (result < 0 && errno == EINTR);
  char notice;
  return result == 1 && (ready.revents & POLLIN) && read(fd, &notice, 1) == 1 && notice == expected;
}

static int check_later_reject(void) {
  int listener = -1, client = -1, notices[2] = { -1, -1 }, status = 0, success = 0;
  pid_t child = -1;
  struct sockaddr_in address = { .sin_len = sizeof(address), .sin_family = AF_INET,
    .sin_addr.s_addr = htonl(INADDR_LOOPBACK) };
  socklen_t length = sizeof(address);
  listener = socket(AF_INET, SOCK_STREAM, 0);
  if (listener < 0 || bind(listener, (struct sockaddr *)&address, sizeof(address)) != 0
      || listen(listener, 1) != 0 || getsockname(listener, (struct sockaddr *)&address, &length) != 0)
    goto cleanup;
  int flags = fcntl(listener, F_GETFL);
  if (flags < 0 || fcntl(listener, F_SETFL, flags | O_NONBLOCK) != 0) goto cleanup;
  flags = fcntl(listener, F_GETFL);
  struct pollfd empty = { .fd = listener, .events = POLLIN };
  if (flags < 0 || witness_poll(&empty, 1, 0) != 0 || pipe(notices) != 0) goto cleanup;
  child = fork();
  if (child < 0) goto cleanup;
  if (child == 0) {
    close(notices[0]);
    alarm(4);
    witness_listener = listener;
    witness_notice = notices[1];
    int result = reject_next(listener);
    if (write(notices[1], "D", 1) != 1) _exit(1);
    _exit(result == 0 ? 0 : 1);
  }
  close(notices[1]);
  notices[1] = -1;
  if (!wait_notice(notices[0], 'W')) {
    fprintf(stderr, "fixture_later_empty_wait_not_observed\n");
    goto cleanup;
  }
  client = socket(AF_INET, SOCK_STREAM, 0);
  struct timeval timeout = { .tv_sec = 2 };
  if (client < 0 || setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout)) != 0
      || connect(client, (struct sockaddr *)&address, sizeof(address)) != 0) goto cleanup;
  char byte;
  ssize_t received = recv(client, &byte, 1, 0);
  int rejected = received == 0 || (received < 0 && errno == ECONNRESET);
  if (!rejected || !wait_notice(notices[0], 'D')) goto cleanup;
  if (waitpid(child, &status, 0) != child) goto cleanup;
  long child_pid = (long)child;
  child = -1;
  int same_flags = fcntl(listener, F_GETFL) == flags;
  success = WIFEXITED(status) && WEXITSTATUS(status) == 0 && same_flags;
  printf("case=later-service-reject empty_before=1 waited_empty_ms=150 client_after_wait=1 rejected=%d service_exit=%d flags_unchanged=%d child_pid=%ld child_reaped=1\n",
         rejected, WIFEXITED(status) ? WEXITSTATUS(status) : -1, same_flags, child_pid);
cleanup:
  if (child > 0) {
    pid_t reaped;
    do { reaped = waitpid(child, NULL, WNOHANG); } while (reaped < 0 && errno == EINTR);
    if (reaped == 0) {
      kill(child, SIGKILL);
      do { reaped = waitpid(child, NULL, 0); } while (reaped < 0 && errno == EINTR);
    }
    fprintf(stderr, "fixture_later_cleanup child_pid=%ld reaped=%d\n", (long)child, reaped == child);
  }
  if (notices[0] >= 0) close(notices[0]);
  if (notices[1] >= 0) close(notices[1]);
  if (client >= 0) close(client);
  if (listener >= 0) close(listener);
  return success;
}

int main(void) {
  int okay = 1;
  okay &= check_descriptor("nonsharing-listener", 0, 1, 0, 1, 0, 1);
  okay &= check_descriptor("blocking-listener", 0, 1, 0, 0, 0, 0);
  okay &= check_descriptor("bound-unlistening", 0, 0, 0, 1, 0, 0);
  okay &= check_descriptor("wrong-type", 0, 0, 1, 1, 0, 0);
  okay &= check_wrong_address();
  okay &= check_descriptor("wrong-port", 0, 1, 0, 1, 1, 0);
  okay &= check_descriptor("sharing-listener", 1, 1, 0, 1, 0, 0);
  okay &= check_wrong_family();
  okay &= check_connected_or_queued(0);
  okay &= check_connected_or_queued(1);
  okay &= check_connected_or_queued(2);
  okay &= check_later_reject();
  return okay ? 0 : 1;
}
