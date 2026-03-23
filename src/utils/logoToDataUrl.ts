import hostedCompanyLogo from "@/assets/company-logo-hosted.png";

const cachedDataUrls = new Map<string, string>();

/**
 * Converts the company logo to a base64 data URL that @react-pdf/renderer can use.
 * Falls back to the bundled local asset if the remote URL fails.
 */
export async function getLogoDataUrl(remoteUrl?: string): Promise<string> {
  if (remoteUrl?.startsWith("data:")) return remoteUrl;

  const urlToFetch = remoteUrl || hostedCompanyLogo;
  const cachedPrimary = cachedDataUrls.get(urlToFetch);
  if (cachedPrimary) return cachedPrimary;

  try {
    const res = await fetch(urlToFetch, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    cachedDataUrls.set(urlToFetch, dataUrl);
    return dataUrl;
  } catch {
    // Remote failed — try the local bundled asset
    const fallbackKey = `fallback:${hostedCompanyLogo}`;
    const cachedFallback = cachedDataUrls.get(fallbackKey);
    if (cachedFallback) return cachedFallback;

    try {
      const res = await fetch(hostedCompanyLogo);
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      cachedDataUrls.set(fallbackKey, dataUrl);
      return dataUrl;
    } catch {
      return "";
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
