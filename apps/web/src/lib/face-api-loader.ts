// Lazily loads face-api.js + models from a CDN at runtime so we don't
// have to bundle / host ~6 MB of weights in the web repo.
// Same recipe as the kiosk, but factored out for reuse.

const FACE_API_CDN =
  "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

declare global {
  interface Window {
    faceapi?: any;
  }
}

let loadPromise: Promise<any> | null = null;

export function loadFaceApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("face-api only runs in the browser"));
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!window.faceapi) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = FACE_API_CDN;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () =>
          reject(new Error("Could not load face-api.js from CDN"));
        document.head.appendChild(s);
      });
    }
    const fa = window.faceapi;
    await fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    await fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    return fa;
  })();

  // If load fails, allow a retry on next call
  loadPromise.catch(() => {
    loadPromise = null;
  });

  return loadPromise;
}

/** Compute a 128-dim face descriptor from a <video> or <img> element. */
export async function describeFace(
  el: HTMLVideoElement | HTMLImageElement,
): Promise<number[] | null> {
  const fa = await loadFaceApi();
  const result = await fa
    .detectSingleFace(el, new fa.TinyFaceDetectorOptions({ inputSize: 320 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  if (!result?.descriptor) return null;
  return Array.from(result.descriptor) as number[];
}
