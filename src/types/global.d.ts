// src/types/global.d.ts
// Global type definitions for window object extensions

import type { RoomClient } from "../services/RoomClient";
import type { RootState } from "./index";

declare global {
  interface Window {
    // MediaSoup debugging
    CLIENT?: RoomClient;
    CC?: RoomClient;
    STORE?: RootState;
    PC1?: RTCPeerConnection; // Send Transport PeerConnection
    PC2?: RTCPeerConnection; // Receive Transport PeerConnection
    DP?: RTCDataChannel; // DataProducer
    DC?: RTCDataChannel; // DataConsumer

    // Debugging flags
    SHOW_INFO?: boolean;
    NETWORK_THROTTLE_SECRET?: string;

    // App and WebRTC related
    RUN?: () => void;
    MEDIASOUP_CLIENT_VERSION?: string;

    // DataChannel testing
    __sendSdps?: () => void;
    __recvSdps?: () => void;
    __startDataChannelTest?: () => void;
    __stopDataChannelTest?: () => void;
    __testSctp?: (options?: { timeout?: number; bot?: boolean }) => void;

    // Debug handlers
    H1?: any; // Send Transport Handler
    H2?: any; // Receive Transport Handler

    // Face-api.js
    faceapi?: any;

    // Data channel test
    dataChannelTestInterval?: NodeJS.Timeout;

    // File system API for artifacts and development
    fs?: {
      readFile: (
        path: string,
        options?: { encoding?: string }
      ) => Promise<ArrayBuffer | string>;
      readFileSync: (
        path: string,
        options?: { encoding?: string }
      ) => ArrayBuffer | string;
    };

    // E2E encryption worker
    postMessage?: (
      message: any,
      targetOrigin: string,
      transfer?: Transferable[]
    ) => void;
  }

  // Extended console for debugging
  interface Console {
    mediasoup?: {
      log: (...args: any[]) => void;
      warn: (...args: any[]) => void;
      error: (...args: any[]) => void;
      debug: (...args: any[]) => void;
    };
  }

  // Extended Navigator for browser detection
  interface Navigator {
    browserLanguage?: string;
    systemLanguage?: string;
    userLanguage?: string;
  }

  // Extended Document for media query detector
  interface Document {
    mediasoupQueryDetector?: HTMLElement;
  }

  // Extended Error for custom errors
  interface Error {
    code?: string | number;
    data?: any;
  }
}

export {};
