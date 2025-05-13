// src/pages/index.tsx
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { initFaceDetection } from "../utils/faceDetection";

// Import App component with client-side only rendering
// This is necessary because mediasoup and WebRTC APIs are not available on the server
const App = dynamic(
  () =>
    import("../components/App").catch((err) => {
      console.error("Failed to load App component:", err);
      return { default: () => <div>Error loading app</div> };
    }),
  {
    ssr: false,
    loading: () => <div>Loading video conferencing app...</div>,
  }
);

export default function HomePage() {
  const [faceDetectionLoaded, setFaceDetectionLoaded] = useState(false);
  const [faceDetectionError, setFaceDetectionError] = useState<string | null>(
    null
  );

  // Load face-api.js models on the client side
  useEffect(() => {
    const loadFaceDetectionModels = async () => {
      try {
        await initFaceDetection();
        setFaceDetectionLoaded(true);
        console.log("Face-api.js models loaded successfully");
      } catch (error) {
        console.error("Failed to load face-api.js models:", error);
        setFaceDetectionError(
          "Failed to load face detection models. Face detection will be disabled."
        );
      }
    };

    loadFaceDetectionModels();
  }, []);

  return (
    <>
      <Head>
        <title>Video Conferencing Platform</title>
        <meta
          name="description"
          content="Video conferencing platform built with Next.js, mediasoup, and WebRTC"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        {faceDetectionError && (
          <div className="error-banner">
            {faceDetectionError}
            <button
              className="close-button"
              onClick={() => setFaceDetectionError(null)}
            >
              ×
            </button>
          </div>
        )}
        <App
          faceDetectionEnabled={faceDetectionLoaded && !faceDetectionError}
        />
      </main>
    </>
  );
}
