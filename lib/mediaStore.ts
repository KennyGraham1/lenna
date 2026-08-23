/* =====================================================
   Attachment storage.

   Photos and files live in IndexedDB as Blobs, not in localStorage as base64.
   localStorage is a ~5MB string store — a handful of photos filled it and
   further writes silently failed. IndexedDB holds Blobs natively, has orders
   of magnitude more room, and never forces us to drop a file to fit.

   App state keeps only the small { id, type, name, size } reference.
   ===================================================== */

const DB_NAME = "hydration-garden-media";
const STORE = "files";
const DB_VERSION = 1;

export type Attachment = {
  id: string;
  type: string; // MIME type ("" when the OS didn't say)
  name: string;
  size: number;
};

export const isImage = (a: { type: string } | null | undefined) =>
  !!a && a.type.startsWith("image/");

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    // Private browsing / blocked storage lands here.
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const request = run(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

function makeMediaId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Camera canvas gives us a data: URL.
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

// Returns null if storage is unavailable, so callers can warn.
export async function saveAttachment(
  input: Blob | File,
  fallbackName = "photo.jpg"
): Promise<Attachment | null> {
  const id = makeMediaId();
  const name = input instanceof File && input.name ? input.name : fallbackName;
  const record = { id, blob: input, type: input.type, name, ts: Date.now() };
  const done = await tx("readwrite", (s) => s.put(record) as IDBRequest<IDBValidKey>);
  if (done === null) return null;
  return { id, type: input.type, name, size: input.size };
}

export async function getAttachmentBlob(id: string): Promise<Blob | null> {
  const rec = await tx<{ blob: Blob } | undefined>(
    "readonly",
    (s) => s.get(id) as IDBRequest<{ blob: Blob } | undefined>
  );
  return rec?.blob ?? null;
}

export async function deleteAttachment(id: string) {
  await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearAttachments() {
  await tx("readwrite", (s) => s.clear() as unknown as IDBRequest<undefined>);
}
