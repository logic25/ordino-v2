import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileIcon } from "lucide-react";

// Parse a stored attachment URL (public-style) and produce a fresh signed URL.
// Bucket "bug-attachments" is private (workspace policy blocks public buckets),
// so the historical getPublicUrl() links return 404. We re-sign on demand.
function parseBucketPath(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    // .../storage/v1/object/(public|sign|authenticated)/<bucket>/<path...>
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2].split("?")[0]) };
  } catch {
    return null;
  }
}

export function useSignedUrl(rawUrl: string) {
  const [url, setUrl] = useState<string>(rawUrl);
  useEffect(() => {
    let active = true;
    const parsed = parseBucketPath(rawUrl);
    if (!parsed) { setUrl(rawUrl); return; }
    supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60).then(({ data }) => {
      if (active && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [rawUrl]);
  return url;
}

export function SignedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const signed = useSignedUrl(src);
  return (
    <a href={signed} target="_blank" rel="noopener noreferrer">
      <img src={signed} alt={alt} className={className} />
    </a>
  );
}

export function SignedFileLink({ src, name, className }: { src: string; name: string; className?: string }) {
  const signed = useSignedUrl(src);
  return (
    <a href={signed} target="_blank" rel="noopener noreferrer" className={className}>
      <FileIcon className="h-3 w-3" />{name}
    </a>
  );
}
