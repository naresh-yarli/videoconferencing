// src/utils/deviceInfo.ts
/**
 * Device detection utility
 * Detects browser, OS, and device capabilities
 * Security: No PII collected, only technical capabilities
 */
// src/utils/deviceInfo.ts
import UAParser from "ua-parser-js";
import {
  DeviceInfo,
  BrowserFlag,
  OSInfo,
  HardwareInfo,
  DeviceCapabilities,
  WebRTCCapabilities,
  MediaCapabilities,
  BrowserCapabilities,
} from "@/types/device";
import Logger from "@/services/Logger";

const logger = new Logger("DeviceInfo");

export function getDeviceInfo(): DeviceInfo {
  const parser = new UAParser(window.navigator.userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const flag = detectBrowserFlag(browser.name);
  const osInfo = detectOSInfo(os, device);
  const hardware = detectHardwareInfo();
  const capabilities = detectCapabilities();

  const deviceInfo: DeviceInfo = {
    flag,
    name: browser.name || "unknown",
    version: browser.version || "unknown",
    os: osInfo,
    hardware,
    capabilities,
  };

  logger.debug("Device info detected", {
    flag: deviceInfo.flag,
    os: deviceInfo.os.name,
    capabilities: {
      webrtc: deviceInfo.capabilities.webrtc.supported,
      media: deviceInfo.capabilities.media,
    },
  });

  return deviceInfo;
}

function detectBrowserFlag(browserName?: string): BrowserFlag {
  if (!browserName) return "unknown";

  const name = browserName.toLowerCase();

  if (name.includes("chrome") || name.includes("chromium")) return "chrome";
  if (name.includes("firefox")) return "firefox";
  if (name.includes("safari") && !name.includes("chrome")) return "safari";
  if (name.includes("edge")) return "edge";
  if (name.includes("opera")) return "opera";

  return "unknown";
}

function detectOSInfo(os: UAParser.IOS, device: UAParser.IDevice): OSInfo {
  let platform: "desktop" | "mobile" | "tablet" = "desktop";

  if (device.type === "mobile") platform = "mobile";
  else if (device.type === "tablet") platform = "tablet";

  return {
    name: os.name || "unknown",
    version: os.version || "unknown",
    platform,
  };
}

function detectHardwareInfo(): HardwareInfo {
  const nav = window.navigator as any;

  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    maxTouchPoints: nav.maxTouchPoints,
  };
}

function detectCapabilities(): DeviceCapabilities {
  return {
    webrtc: detectWebRTCCapabilities(),
    media: detectMediaCapabilities(),
    browser: detectBrowserCapabilities(),
  };
}

function detectWebRTCCapabilities(): WebRTCCapabilities {
  const hasWebRTC = !!(
    window.RTCPeerConnection ||
    (window as any).webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection
  );

  return {
    supported: hasWebRTC,
    simulcast: hasWebRTC && supportsSimulcast(),
    svc: hasWebRTC && supportsSVC(),
    dataChannel: hasWebRTC && Boolean(window.RTCDataChannel),
    turnSupport: hasWebRTC,
  };
}

function detectMediaCapabilities(): MediaCapabilities {
  const hasMediaDevices = Boolean(navigator.mediaDevices);

  return {
    audio: hasMediaDevices,
    video: hasMediaDevices,
    screenShare:
      hasMediaDevices && Boolean(navigator.mediaDevices.getDisplayMedia),
    speakers: hasMediaDevices && "setSinkId" in HTMLMediaElement.prototype,
    microphone: hasMediaDevices,
    camera: hasMediaDevices,
  };
}

function detectBrowserCapabilities(): BrowserCapabilities {
  return {
    webGL: supportsWebGL(),
    webWorker: Boolean(window.Worker),
    serviceWorker: "serviceWorker" in navigator,
    localStorage: supportsLocalStorage(),
    sessionStorage: supportsSessionStorage(),
    indexedDB: Boolean(window.indexedDB),
    webAssembly: Boolean(window.WebAssembly),
  };
}

function supportsSimulcast(): boolean {
  const browser = detectBrowserFlag(new UAParser().getBrowser().name);
  return ["chrome", "firefox", "safari"].includes(browser);
}

function supportsSVC(): boolean {
  const browser = detectBrowserFlag(new UAParser().getBrowser().name);
  return browser === "chrome";
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function supportsLocalStorage(): boolean {
  try {
    localStorage.setItem("test", "test");
    localStorage.removeItem("test");
    return true;
  } catch {
    return false;
  }
}

function supportsSessionStorage(): boolean {
  try {
    sessionStorage.setItem("test", "test");
    sessionStorage.removeItem("test");
    return true;
  } catch {
    return false;
  }
}

export default getDeviceInfo;
