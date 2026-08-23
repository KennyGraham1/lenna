"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { frameToDataUrl, pickImageFile } from "@/lib/photo";

/** Resolves with a JPEG data URL, or null if the user backed out. */
type OpenCamera = (title?: string) => Promise<string | null>;

const CameraContext = createContext<OpenCamera>(async () => null);

export const useCamera = () => useContext(CameraContext);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Take a photo");
  const [status, setStatus] = useState<string | null>(null);
  const [still, setStill] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resolverRef = useRef<((v: string | null) => void) | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /** Tear the modal down and hand `value` back to whoever opened it. */
  const finish = useCallback(
    (value: string | null) => {
      stopStream();
      setOpen(false);
      setStill(null);
      setStatus(null);
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve?.(value);
    },
    [stopStream]
  );

  /** Hand off to the OS file picker with the modal already dismissed. */
  const finishViaPicker = useCallback(async () => {
    stopStream();
    setOpen(false);
    finish(await pickImageFile());
  }, [finish, stopStream]);

  const openCamera = useCallback<OpenCamera>(
    (nextTitle = "Take a photo") =>
      new Promise<string | null>((resolve) => {
        resolverRef.current = resolve;
        setTitle(nextTitle);
        setStill(null);
        setStatus("Starting camera...");
        setOpen(true);
      }),
    []
  );

  // Acquire the stream once the modal is mounted, falling back to a file picker.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        // Browser has no camera API — go straight to the file picker.
        await finishViaPicker();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus(null);
      } catch {
        if (cancelled) return;
        setStatus("Couldn't open camera 😕 — using file picker instead.");
        setTimeout(async () => {
          if (cancelled) return;
          void finishViaPicker();
        }, 900);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `finish` is stable; re-running on every render would restart the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => stopStream, [stopStream]);

  // Escape backs out of the modal, matching every other dialog on the platform.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  const capture = () => {
    if (!videoRef.current) return;
    const data = frameToDataUrl(videoRef.current);
    if (data) setStill(data);
  };

  const useFilePicker = () => {
    // Switch from live capture to the file picker without losing the caller.
    void finishViaPicker();
  };

  return (
    <CameraContext.Provider value={openCamera}>
      {children}
      <div
        id="camera-modal"
        className={`camera-modal ${open ? "" : "hidden"}`}
        aria-hidden={!open}
        role="dialog"
        aria-modal={open}
        aria-label={title}
      >
        <div className="camera-header">
          <h3 id="camera-title">{title}</h3>
          <button className="icon-btn" aria-label="Close camera" onClick={() => finish(null)}>
            ✕
          </button>
        </div>

        <div className="camera-stage">
          <video
            ref={videoRef}
            id="camera-video"
            className={still ? "hidden" : ""}
            autoPlay
            playsInline
            muted
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="camera-still" className={still ? "" : "hidden"} src={still ?? undefined} alt="" />
          <div className={`camera-status ${status ? "" : "hidden"}`}>{status}</div>
        </div>

        <div className="camera-controls">
          {!still && (
            <div id="camera-pre">
              <button className="btn-shutter" onClick={capture}>
                📸 Capture
              </button>
              <button className="btn btn-ghost-dark btn-camera-upload" onClick={useFilePicker}>
                📁 Or pick from files
              </button>
            </div>
          )}
          {still && (
            <div id="camera-post" className="row-buttons">
              <button className="btn btn-ghost-dark" onClick={() => setStill(null)}>
                ↻ Retake
              </button>
              <button className="btn btn-primary" onClick={() => finish(still)}>
                ✓ Use photo
              </button>
            </div>
          )}
        </div>
      </div>
    </CameraContext.Provider>
  );
}
