// src/types/face-api.d.ts
// Type definitions for face-api.js

declare module "face-api.js" {
  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number });
  }

  export interface FaceDetection {
    score: number;
    box: Box;
  }

  export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export async function detectSingleFace(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    options?: TinyFaceDetectorOptions
  ): Promise<FaceDetection | undefined>;

  export const nets: {
    tinyFaceDetector: {
      loadFromUri(url: string): Promise<void>;
      loadFromDisk(path: string): Promise<void>;
      isLoaded: boolean;
    };
  };

  export function resizeResults(
    result: FaceDetection | FaceDetection[],
    dimensions: { width: number; height: number }
  ): FaceDetection | FaceDetection[];

  export const draw: {
    drawDetections(
      canvas: HTMLCanvasElement,
      detections: FaceDetection | FaceDetection[]
    ): void;
  };
}
