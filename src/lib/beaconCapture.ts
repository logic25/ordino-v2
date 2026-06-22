// Beacon bug-report auto-capture utilities.
// - Records recent failed network requests via a fetch monkey-patch (installed on import).
// - captureSnapshot() lazily loads html2canvas to capture screenshot + gzipped HTML.
// Capture only runs when the BeaconChatWidget detects bug intent client-side.

type NetFailure = { url: string; status: number; ms: number; ts: number };
const ringBuffer: NetFailure[] = [];
const MAX = 20;
const WINDOW_MS = 30_000;

function pushFailure(f: NetFailure) {
  ringBuffer.push(f);
  while (ringBuffer.length > MAX) ringBuffer.shift();
}

function recentFailures(): NetFailure[] {
  const cutoff = Date.now() - WINDOW_MS;
  return ringBuffer.filter((f) => f.ts >= cutoff);
}

// Install fetch recorder once. Safe to import multiple times.
declare global {
  interface Window { __beaconFetchPatched?: boolean }
}
if (typeof window !== "undefined" && !window.__beaconFetchPatched) {
  window.__beaconFetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const start = performance.now();
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    try {
      const res = await orig(...args);
      if (res.status >= 400) {
        pushFailure({ url, status: res.status, ms: Math.round(performance.now() - start), ts: Date.now() });
      }
      return res;
    } catch (e) {
      pushFailure({ url, status: 0, ms: Math.round(performance.now() - start), ts: Date.now() });
      throw e;
    }
  };
}

async function gzipString(s: string): Promise<Blob> {
  if (typeof CompressionStream === "undefined") {
    return new Blob([s], { type: "text/html" });
  }
  const stream = new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export interface BeaconSnapshot {
  screenshot_b64: string | null;
  html_gz_b64: string | null;
  network: NetFailure[];
  ua: string;
  viewport: { w: number; h: number; dpr: number };
  url: string;
  ts: number;
}

export async function captureSnapshot(): Promise<BeaconSnapshot> {
  let screenshot_b64: string | null = null;
  let html_gz_b64: string | null = null;

  try {
    const { default: html2canvas } = await import("html2canvas");
    const width = Math.min(window.innerWidth, 1280);
    const scale = width / window.innerWidth;
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      backgroundColor: "#ffffff",
      scale,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.7));
    if (blob) screenshot_b64 = await blobToBase64(blob);
  } catch (e) {
    console.warn("[beaconCapture] screenshot failed", e);
  }

  try {
    const html = document.documentElement.outerHTML;
    // Cap HTML at 2MB pre-gzip to bound payload.
    const capped = html.length > 2_000_000 ? html.slice(0, 2_000_000) : html;
    const gz = await gzipString(capped);
    html_gz_b64 = await blobToBase64(gz);
  } catch (e) {
    console.warn("[beaconCapture] html snapshot failed", e);
  }

  return {
    screenshot_b64,
    html_gz_b64,
    network: recentFailures(),
    ua: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    url: window.location.href,
    ts: Date.now(),
  };
}

// Mirrors server-side keyword detection (beacon-proxy). Keep loose/permissive.
const BUG_PATTERNS = [
  /\bbug\b/i, /\bbroken\b/i, /not working/i, /doesn'?t work/i, /won'?t (load|open|save|submit)/i,
  /can'?t (load|open|save|submit|click|see|find)/i, /\berror\b/i, /\bcrash/i, /\bfail/i,
  /blank (screen|page)/i, /something is wrong/i, /this is wrong/i, /should (be|show|have)/i,
  /missing/i, /glitch/i, /freezing/i, /stuck/i,
];

export function looksLikeBug(text: string): boolean {
  if (!text || text.length < 4) return false;
  return BUG_PATTERNS.some((p) => p.test(text));
}
