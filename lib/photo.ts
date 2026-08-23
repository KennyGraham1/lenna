/* Image helpers — downscale captures/uploads before they go into localStorage. */

export function readImageAsDataUrl(file: File, maxDim = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No 2d context"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = String(e.target?.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Pick any file at all — images, PDFs, whatever. Returns the raw File so the
 * caller can hand it straight to the media store without re-encoding.
 */
export function pickAnyFile(accept = ""): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.oncancel = () => resolve(null);
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** File-input fallback when the camera API is unavailable or denied. */
export function pickImageFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    // Browsers fire `cancel` when the dialog is dismissed; without this the
    // promise would hang forever and the caller would wait on a photo that
    // is never coming.
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await readImageAsDataUrl(file));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

export function frameToDataUrl(video: HTMLVideoElement, maxDim = 800): string | null {
  if (!video.videoWidth) return null;
  const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.72);
}
