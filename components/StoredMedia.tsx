"use client";

import { useEffect, useState } from "react";
import { getAttachmentBlob, isImage } from "@/lib/mediaStore";
import type { MediaRef } from "@/lib/state";

/** Resolve a stored blob to an object URL for the lifetime of this component. */
export function useAttachmentUrl(id: string | undefined | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let revoked = false;
    let objectUrl: string | null = null;

    getAttachmentBlob(id).then((blob) => {
      if (!blob || revoked) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [id]);

  return url;
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

/**
 * Renders an attachment: images inline, anything else as a labelled chip.
 * `legacy` carries the old inline base64 so pre-existing check-ins still show.
 */
export function StoredMedia({
  media,
  legacy,
  alt = "",
  className
}: {
  media?: MediaRef | null;
  legacy?: string | null;
  alt?: string;
  className?: string;
}) {
  const url = useAttachmentUrl(isImage(media) ? media?.id : null);

  if (media && !isImage(media)) {
    return (
      <span className={`file-chip ${className ?? ""}`} title={media.name}>
        <span className="file-chip-ext">{extensionOf(media.name)}</span>
        <span className="file-chip-name">{media.name}</span>
      </span>
    );
  }

  const src = url ?? legacy ?? null;
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
