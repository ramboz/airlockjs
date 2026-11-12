export function validBootstrapCommand(args) {
  return Array.isArray(args) && args.length === 2 && args[0] === "js" &&
    typeof args[1] === "number" && args[1] % 1 === 0 &&
    args[1] >= -8640000000000000 && args[1] <= 8640000000000000;
}
