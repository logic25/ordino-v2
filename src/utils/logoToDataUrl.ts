import hostedCompanyLogo from "@/assets/company-logo-hosted.png";

let cachedDataUrl: string | null = null;

/**
 * Converts the company logo to a base64 data URL that @react-pdf/renderer can use.
 * Falls back to the bundled local asset if the remote URL fails.
 */
export async function getLogoDataUrl(remoteUrl?: string): Promise<string> {
  if (cachedDataUrl) return cachedDataUrl;

  const urlToFetch = remoteUrl || hostedCompanyLogo;

  try {
    const res = await fetch(urlToFetch, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    cachedDataUrl = await blobToDataUrl(blob);
    return cachedDataUrl;
  } catch {
    // Remote failed — try the local bundled asset
    try {
      const res = await fetch(hostedCompanyLogo);
      const blob = await res.blob();
      cachedDataUrl = await blobToDataUrl(blob);
      return cachedDataUrl;
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
