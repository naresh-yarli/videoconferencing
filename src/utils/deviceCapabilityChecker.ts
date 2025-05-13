// src/utils/deviceCapabilityChecker.ts
/**
 * Device capability checker
 * Validates device requirements for video conferencing
 */
import { DeviceInfo } from "@/types/device";
import Logger from "@/services/Logger";

const logger = new Logger("DeviceCapabilityChecker");

export interface CapabilityRequirements {
  webrtc: boolean;
  audio: boolean;
  video: boolean;
  dataChannel: boolean;
}

export interface CapabilityCheck {
  passed: boolean;
  missing: string[];
  warnings: string[];
}

export function checkDeviceCapabilities(
  device: DeviceInfo,
  requirements: Partial<CapabilityRequirements> = {}
): CapabilityCheck {
  const defaultRequirements: CapabilityRequirements = {
    webrtc: true,
    audio: true,
    video: false,
    dataChannel: true,
    ...requirements,
  };

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check WebRTC support
  if (defaultRequirements.webrtc && !device.capabilities.webrtc.supported) {
    missing.push("WebRTC");
  }

  // Check audio support
  if (defaultRequirements.audio && !device.capabilities.media.audio) {
    missing.push("Audio");
  }

  // Check video support
  if (defaultRequirements.video && !device.capabilities.media.video) {
    missing.push("Video");
  }

  // Check data channel support
  if (
    defaultRequirements.dataChannel &&
    !device.capabilities.webrtc.dataChannel
  ) {
    missing.push("Data Channel");
  }

  // Browser-specific warnings
  if (device.flag === "safari") {
    warnings.push("Safari may have limited WebRTC support");
  }

  // Hardware warnings
  if (device.hardware.deviceMemory && device.hardware.deviceMemory < 4) {
    warnings.push("Low device memory may affect performance");
  }

  const result: CapabilityCheck = {
    passed: missing.length === 0,
    missing,
    warnings,
  };

  logger.debug("Device capability check", result);
  return result;
}

export function checkMediaDevicePermissions(): Promise<{
  audio: boolean;
  video: boolean;
}> {
  return navigator.permissions
    .query({ name: "microphone" as PermissionName })
    .then((audioPermission) =>
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((videoPermission) => ({
          audio: audioPermission.state === "granted",
          video: videoPermission.state === "granted",
        }))
    )
    .catch(() => ({ audio: false, video: false }));
}
