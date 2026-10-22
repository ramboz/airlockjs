#include <errno.h>
#include <inttypes.h>
#include <libproc.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/proc.h>
#include <sys/proc_info.h>
#include <sys/socket.h>
#include <unistd.h>

#define LIMIT 256

struct lifetime {
  struct proc_bsdinfo bsd;
  char image[PROC_PIDPATHINFO_MAXSIZE];
};

struct descriptor {
  struct proc_fdinfo fd;
  uint64_t identity;
  int family;
};

static int failure(const char *stage) {
  fprintf(stderr, "{\"schema\":\"airlock.owned-socket-observer-error.v1\","
          "\"stage\":\"%s\",\"errno\":%d}\n", stage, errno);
  return 2;
}

static int observe(pid_t pid, struct lifetime *value) {
  memset(value, 0, sizeof(*value));
  if (proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &value->bsd, sizeof(value->bsd)) !=
      (int)sizeof(value->bsd) || value->bsd.pbi_pid != (uint32_t)pid ||
      value->bsd.pbi_uid != getuid() ||
      (value->bsd.pbi_status != SRUN && value->bsd.pbi_status != SSLEEP))
    return -1;
  int length = proc_pidpath(pid, value->image, sizeof(value->image));
  if (length <= 0 || length >= (int)sizeof(value->image) ||
      memchr(value->image, '\0', sizeof(value->image)) == NULL) return -1;
  return 0;
}

static int same(const struct lifetime *a, const struct lifetime *b) {
  return a->bsd.pbi_pid == b->bsd.pbi_pid && a->bsd.pbi_ppid == b->bsd.pbi_ppid &&
         a->bsd.pbi_pgid == b->bsd.pbi_pgid && a->bsd.pbi_uid == b->bsd.pbi_uid &&
         a->bsd.pbi_start_tvsec == b->bsd.pbi_start_tvsec &&
         a->bsd.pbi_start_tvusec == b->bsd.pbi_start_tvusec &&
         strcmp(a->image, b->image) == 0;
}

static int owned_child(pid_t parent, pid_t child) {
  pid_t children[32];
  int count = proc_listchildpids(parent, children, sizeof(children));
  if (count <= 0 || count >= (int)(sizeof(children) / sizeof(children[0]))) return 0;
  for (int n = 0; n < count; n++)
    if (children[n] == child) return 1;
  return 0;
}

static int topology(pid_t target, int helper, pid_t engine, pid_t launcher, pid_t caller, struct lifetime roles[4]) {
  if (getppid() != caller || observe(caller, &roles[0]) || !owned_child(caller, engine) ||
      observe(engine, &roles[1]) || !owned_child(engine, launcher) ||
      observe(launcher, &roles[2])) return -1;
  if (helper && (!owned_child(launcher, target) || observe(target, &roles[3]))) return -1;
  if (!helper && target != launcher) return -1;
  if (roles[1].bsd.pbi_ppid != roles[0].bsd.pbi_pid ||
      roles[1].bsd.pbi_pgid != roles[1].bsd.pbi_pid ||
      roles[2].bsd.pbi_ppid != roles[1].bsd.pbi_pid ||
      roles[2].bsd.pbi_pgid != roles[2].bsd.pbi_pid ||
      roles[0].bsd.pbi_pid == roles[1].bsd.pbi_pid ||
      roles[0].bsd.pbi_pid == roles[2].bsd.pbi_pid ||
      roles[1].bsd.pbi_pid == roles[2].bsd.pbi_pid)
    return -1;
  if (helper && (roles[3].bsd.pbi_ppid != roles[2].bsd.pbi_pid ||
      roles[3].bsd.pbi_pgid != roles[2].bsd.pbi_pid ||
      roles[3].bsd.pbi_pid == roles[0].bsd.pbi_pid ||
      roles[3].bsd.pbi_pid == roles[1].bsd.pbi_pid ||
      roles[3].bsd.pbi_pid == roles[2].bsd.pbi_pid))
    return -1;
  return 0;
}

static int compare_fd(const void *left, const void *right) {
  int a = ((const struct proc_fdinfo *)left)->proc_fd;
  int b = ((const struct proc_fdinfo *)right)->proc_fd;
  return (a > b) - (a < b);
}

static int inventory(pid_t pid, struct proc_fdinfo values[LIMIT]) {
  int bytes = proc_pidinfo(pid, PROC_PIDLISTFDS, 0, values,
                          LIMIT * (int)sizeof(values[0]));
  if (bytes <= 0 || bytes >= LIMIT * (int)sizeof(values[0]) ||
      bytes % (int)sizeof(values[0]) != 0) return -1;
  int count = bytes / (int)sizeof(values[0]);
  qsort(values, count, sizeof(values[0]), compare_fd);
  for (int n = 0; n < count; n++) {
    unsigned int type = values[n].proc_fdtype;
    if (values[n].proc_fd < 0 || (n && values[n - 1].proc_fd == values[n].proc_fd) ||
        type > PROX_FDTYPE_NEXUS || type == 8) return -1;
  }
  return count;
}

static int socket_value(pid_t pid, int fd, uint64_t *identity, int *family) {
  struct socket_fdinfo info = {0};
  if (proc_pidfdinfo(pid, fd, PROC_PIDFDSOCKETINFO, &info, sizeof(info)) !=
      (int)sizeof(info) || info.psi.soi_so == 0) return -1;
  *identity = info.psi.soi_so;
  *family = info.psi.soi_family;
  return 0;
}

static void print_lifetime(const struct lifetime *value) {
  printf("{\"pid\":%u,\"ppid\":%u,\"pgid\":%u,\"uid\":%u,"
         "\"birth_seconds\":%" PRIu64 ",\"birth_microseconds\":%" PRIu64 "}",
         value->bsd.pbi_pid, value->bsd.pbi_ppid, value->bsd.pbi_pgid,
         value->bsd.pbi_uid, value->bsd.pbi_start_tvsec, value->bsd.pbi_start_tvusec);
}

static pid_t parse_pid(const char *text) {
  if (text[0] < '1' || text[0] > '9') return -1;
  for (const char *at = text; *at; at++)
    if (*at < '0' || *at > '9') return -1;
  char *end = NULL;
  errno = 0;
  long number = strtol(text, &end, 10);
  return errno || *end || number <= 0 || number > INT_MAX ? -1 : (pid_t)number;
}

int main(int argc, char **argv) {
  if (argc != 6 || (strcmp(argv[1], "launcher") && strcmp(argv[1], "helper")))
    return failure("closed-role");
  pid_t target = parse_pid(argv[2]), engine = parse_pid(argv[3]), launcher = parse_pid(argv[4]);
  pid_t caller = parse_pid(argv[5]);
  if (target < 1 || engine < 1 || launcher < 1 || caller < 1 || getppid() != caller)
    return failure("target-pid");
  int helper = strcmp(argv[1], "helper") == 0, role_count = helper ? 4 : 3;
  struct lifetime before[4] = {0}, after[4] = {0}, current;
  struct proc_fdinfo first[LIMIT], final[LIMIT];
  struct descriptor result[LIMIT] = {0};
  alarm(1);
  if (topology(target, helper, engine, launcher, caller, before)) return failure("caller-owned-ancestry");
  int count = inventory(target, first);
  if (count <= 0) return failure("complete-inventory-before");
  for (int n = 0; n < count; n++) {
    result[n].fd = first[n];
    if (getppid() != caller || observe(target, &current) || !same(&before[helper ? 3 : 2], &current))
      return failure("target-lifetime-before-fd");
    if (first[n].proc_fdtype == PROX_FDTYPE_SOCKET &&
        socket_value(target, first[n].proc_fd, &result[n].identity, &result[n].family))
      return failure("socket-query");
  }
  int final_count = inventory(target, final);
  if (final_count != count || memcmp(first, final, count * sizeof(first[0])) != 0)
    return failure("complete-inventory-changed");
  for (int n = 0; n < count; n++) {
    if (first[n].proc_fdtype != PROX_FDTYPE_SOCKET) continue;
    uint64_t identity;
    int family;
    if (getppid() != caller || socket_value(target, first[n].proc_fd, &identity, &family) ||
        identity != result[n].identity || family != result[n].family)
      return failure("socket-identity-changed");
  }
  if (topology(target, helper, engine, launcher, caller, after)) return failure("ancestry-after");
  for (int n = 0; n < role_count; n++)
    if (!same(&before[n], &after[n])) return failure("ancestry-changed");
  printf("{\"schema\":\"airlock.owned-macos-socket-inventory.v1\","
         "\"role\":\"%s\",\"pid\":%d,\"caller_pid\":%d,\"complete\":true,"
         "\"roles_before\":[", argv[1], target, caller);
  for (int n = 0; n < role_count; n++) {
    if (n) putchar(',');
    print_lifetime(&before[n]);
  }
  printf("],\"roles_after\":[");
  for (int n = 0; n < role_count; n++) {
    if (n) putchar(',');
    print_lifetime(&after[n]);
  }
  printf("],\"inventory_before\":[");
  for (int n = 0; n < count; n++) {
    if (n) putchar(',');
    printf("{\"fd\":%d,\"type\":%u}", first[n].proc_fd, first[n].proc_fdtype);
  }
  printf("],\"inventory_after\":[");
  for (int n = 0; n < count; n++) {
    if (n) putchar(',');
    printf("{\"fd\":%d,\"type\":%u}", final[n].proc_fd, final[n].proc_fdtype);
  }
  printf("],\"descriptor_count\":%d,\"descriptors\":[", count);
  for (int n = 0; n < count; n++) {
    if (n) putchar(',');
    printf("{\"fd\":%d,\"type\":%u,\"family\":", result[n].fd.proc_fd, result[n].fd.proc_fdtype);
    if (result[n].fd.proc_fdtype == PROX_FDTYPE_SOCKET)
      printf("%d,\"identity\":\"0x%016" PRIx64 "\"}", result[n].family, result[n].identity);
    else printf("null,\"identity\":null}");
  }
  printf("],\"native_authority\":false}\n");
  alarm(0);
  return ferror(stdout) ? failure("output") : 0;
}
