const MAX_AGE = 90 * 24 * 60 * 60;
const APPENDICES = new Set(["AQ", "Ag", "Aw", "BA", "BQ", "Bg"]);

function unpack(value) {
  if (typeof value !== "string" || value.length > 256) return null;
  const parts = value.split(".");
  if (parts.length !== 4 && parts.length !== 5) return null;
  const [version, domainPart, timePart, payload, appendix] = parts;
  const domainIndex = parseInt(domainPart, 10);
  const timestamp = parseInt(timePart, 10);
  if (!version.includes("fb") || Number.isNaN(domainIndex) || domainIndex < 0 ||
      Number.isNaN(timestamp) || !payload ||
      appendix !== undefined && !(appendix.length === 8 || APPENDICES.has(appendix))) return null;
  return { domainIndex, timestamp, payload, appendix };
}

function pack(cookie) {
  return ["fb", cookie.domainIndex, cookie.timestamp, cookie.payload, cookie.appendix]
    .filter((part) => part !== undefined).join(".");
}

export async function pageViewCookie(cookies, pageURL) {
  const url = new URL(pageURL);
  const hostname = url.hostname;
  if (!["http:", "https:"].includes(url.protocol) || hostname === "facebook.com" ||
      hostname.endsWith(".facebook.com")) return null;
  const labels = hostname.split(".");
  const existing = unpack(await cookies.get("_fbp"));
  const set = (value, domainIndex) => cookies.set("_fbp", value, {
    maxAge: MAX_AGE, path: "/", domain: labels.slice(-1 - domainIndex).join("."), sameSite: "lax",
  });
  if (existing && existing.domainIndex < labels.length) {
    const value = pack(existing);
    await set(value, existing.domainIndex);
    if (await cookies.get("_fbp") !== value) throw new Error("cookie-access-failed");
    return value;
  }
  const cookie = {
    timestamp: Date.now(),
    payload: `${Math.floor(Math.random() * 999999999)}${Math.floor(Math.random() * 999999999)}`,
  };
  for (let domainIndex = 0; domainIndex < labels.length; domainIndex += 1) {
    const value = pack({ ...cookie, domainIndex });
    await set(value, domainIndex);
    if (await cookies.get("_fbp") === value) return value;
  }
  throw new Error("cookie-access-failed");
}
