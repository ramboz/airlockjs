const FRAME_PATH = "/rig/google-browser-operation-frame.html";
const FRAME_BYTES = "<!doctype html>\n<html><head></head><body></body></html>\n";

export function googleBrowserFramePolicy(origins) {
  return "default-src 'none'; script-src 'none'; worker-src 'none'; frame-src 'none'; " +
    `object-src 'none'; connect-src ${origins.join(" ")}`;
}

export async function createGoogleBrowserRealm(origins, onLoss, signal) {
  const frameURL = new URL(FRAME_PATH, document.URL);
  if (frameURL.origin !== location.origin) throw new Error("frame-origin");
  const response = await fetch(frameURL.href, { credentials: "omit", redirect: "error", cache: "no-store", signal });
  if (response.status !== 200 || response.url !== frameURL.href ||
      response.headers.get("content-security-policy") !== googleBrowserFramePolicy(origins) ||
      response.headers.get("content-length") !== String(new TextEncoder().encode(FRAME_BYTES).byteLength)) {
    throw new Error("frame-policy");
  }
  if (!response.body) throw new Error("frame-bytes");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > FRAME_BYTES.length) throw new Error("frame-bytes");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (text !== FRAME_BYTES) throw new Error("frame-bytes");
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }

  const frame = document.createElement("iframe");
  frame.hidden = true;
  let closed = false;
  let observer;
  try {
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        signal.removeEventListener("abort", aborted);
        frame.removeEventListener("load", success);
        frame.removeEventListener("error", failed);
        if (error) reject(error);
        else resolve();
      };
      const success = () => finish();
      const failed = () => finish(new Error("frame-load"));
      const aborted = () => finish(new Error("frame-aborted"));
      frame.addEventListener("load", success);
      frame.addEventListener("error", failed);
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) { aborted(); return; }
      frame.src = frameURL.href;
      document.body.appendChild(frame);
    });
    const window = frame.contentWindow;
    const child = frame.contentDocument;
    if (!window || !child || child.URL !== frameURL.href || child.defaultView !== window ||
        typeof window.fetch !== "function" || typeof window.Request !== "function") throw new Error("frame-identity");
    const realmFetch = window.fetch;
    const realmRequest = window.Request;
    const valid = () => {
      try {
        return !closed && frame.isConnected && frame.contentWindow === window &&
          frame.contentDocument === child && child.defaultView === window && child.URL === frameURL.href &&
          typeof realmFetch === "function" && typeof realmRequest === "function";
      } catch { return false; }
    };
    const lost = () => { if (!closed && !valid()) onLoss(); };
    frame.addEventListener("load", lost);
    observer = new MutationObserver(lost);
    observer.observe(document, { childList: true, subtree: true });
    if (!valid()) throw new Error("frame-identity");
    return {
      valid,
      fetch(url, init) {
        if (!valid()) throw new Error("frame-identity");
        return realmFetch.call(window, url, init);
      },
      dispose() {
        if (closed) return;
        closed = true;
        observer.disconnect();
        frame.removeEventListener("load", lost);
        frame.remove();
      },
    };
  } catch (error) {
    closed = true;
    observer?.disconnect();
    frame.remove();
    throw error;
  }
}
