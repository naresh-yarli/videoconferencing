// src/utils/faceDetection.ts
import * as faceapi from "face-api.js";

let modelsLoaded = false;

/**
 * Initializes the face detection models
 * @returns Promise that resolves when models are loaded
 */
export async function initFaceDetection(): Promise<void> {
  try {
    if (modelsLoaded) {
      console.log("Face detection models already loaded");
      return;
    }

    console.log(
      "Loading face detection models (using face-api.js internal TF setup)..."
    );

    // Set custom model location
    const MODEL_URL = "/models";

    // Load tiny face detector model
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    console.log("Face detection models loaded successfully");
    modelsLoaded = true;
  } catch (error) {
    console.error("Failed to load face detection models:", error);
    throw error;
  }
}

/**
 * Check if face detection models are loaded
 */
export function areFaceDetectionModelsLoaded(): boolean {
  return modelsLoaded || faceapi.nets.tinyFaceDetector.isLoaded;
}

/**
 * Get tiny face detector options
 */
export function getTinyFaceDetectorOptions(): faceapi.TinyFaceDetectorOptions {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,
    scoreThreshold: 0.5,
  });
}

/**
 * Detect face in a video element
 * @param videoElement The video element
 * @returns Promise with detection result
 */
export async function detectFace(
  videoElement: HTMLVideoElement
): Promise<faceapi.FaceDetection | null> {
  if (!areFaceDetectionModelsLoaded()) {
    console.warn("Face detection models not loaded");
    return null;
  }

  // Check if video is playing and has dimensions
  if (
    !videoElement ||
    videoElement.readyState < 2 ||
    videoElement.videoWidth === 0 ||
    videoElement.videoHeight === 0
  ) {
    return null;
  }

  try {
    const detectionResult = await faceapi.detectSingleFace(
      videoElement,
      getTinyFaceDetectorOptions()
    );
    return detectionResult || null;
  } catch (error) {
    console.error("Face detection error:", error);
    return null;
  }
}

/**
 * Draw face detection result on canvas
 * @param detection The detection result
 * @param canvas The canvas element
 * @param videoElement The video element
 */
export function drawFaceDetection(
  detection: faceapi.FaceDetection | null,
  canvas: HTMLCanvasElement,
  videoElement: HTMLVideoElement
): void {
  if (!detection || !canvas || !videoElement) {
    // If no detection, clear the canvas
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    return;
  }

  // Set canvas dimensions to match video element
  const width = videoElement.offsetWidth;
  const height = videoElement.offsetHeight;

  canvas.width = width;
  canvas.height = height;

  // Resize the detection result to match canvas dimensions
  const resizedDetection = faceapi.resizeResults(detection, {
    width,
    height,
  });

  // Draw the detection on the canvas
  faceapi.draw.drawDetections(canvas, resizedDetection);
}
