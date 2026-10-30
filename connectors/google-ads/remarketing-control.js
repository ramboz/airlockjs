export function validRemarketingDisableCommand(args) {
  return Array.isArray(args) && args.length === 3 && args[0] === "set" &&
    args[1] === "allow_ad_personalization_signals" && args[2] === false;
}
