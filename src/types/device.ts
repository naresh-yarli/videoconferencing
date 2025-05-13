// src/types/device.ts
/**
 * Device capability interfaces
 * Defines types for device detection and capabilities
 */
export interface DeviceInfo {
  flag: BrowserFlag;
  name: string;
  version: string;
  os: OSInfo;
  hardware: HardwareInfo;
  capabilities: DeviceCapabilities;
}

export type BrowserFlag =
  | "chrome"
  | "firefox"
  | "safari"
  | "edge"
  | "opera"
  | "unknown";

export interface OSInfo {
  name: string;
  version: string;
  platform: "desktop" | "mobile" | "tablet";
}

export interface HardwareInfo {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  maxTouchPoints?: number;
}

export interface DeviceCapabilities {
  webrtc: WebRTCCapabilities;
  media: MediaCapabilities;
  browser: BrowserCapabilities;
}

export interface WebRTCCapabilities {
  supported: boolean;
  simulcast: boolean;
  svc: boolean;
  dataChannel: boolean;
  turnSupport: boolean;
}

export interface MediaCapabilities {
  audio: boolean;
  video: boolean;
  screenShare: boolean;
  speakers: boolean;
  microphone: boolean;
  camera: boolean;
}

export interface BrowserCapabilities {
  webGL: boolean;
  webWorker: boolean;
  serviceWorker: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  webAssembly: boolean;
}
