// src/utils/mediaCapabilityChecker.ts
/**
 * Media capability checking utilities
 * Tests device capabilities and permissions
 */
import Logger from "@/services/Logger";

const logger = new Logger("MediaCapabilityChecker");

export interface MediaCheckResult {
  supported: boolean;
  constraints?: MediaTrackCapabilities;
  error?: string;
}

export interface PermissionStatus {
  camera: PermissionState;
  microphone: PermissionState;
}

export async function checkMediaPermissions(): Promise<PermissionStatus> {
  try {
    const [camera, microphone] = await Promise.all([
      navigator.permissions.query({ name: "camera" as PermissionName }),
      navigator.permissions.query({ name: "microphone" as PermissionName }),
    ]);

    return {
      camera: camera.state,
      microphone: microphone.state,
    };
  } catch (error) {
    logger.error("Permission check failed", error);
    return {
      camera: "prompt",
      microphone: "prompt",
    };
  }
}

export async function checkCameraCapabilities(
  deviceId?: string
): Promise<MediaCheckResult> {
  try {
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.() || {};

    stream.getTracks().forEach((t) => t.stop());

    return {
      supported: true,
      constraints: capabilities,
    };
  } catch (error) {
    logger.error("Camera capability check failed", error);
    return {
      supported: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function checkMicrophoneCapabilities(
  deviceId?: string
): Promise<MediaCheckResult> {
  try {
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getAudioTracks()[0];
    const capabilities = track.getCapabilities?.() || {};

    stream.getTracks().forEach((t) => t.stop());

    return {
      supported: true,
      constraints: capabilities,
    };
  } catch (error) {
    logger.error("Microphone capability check failed", error);
    return {
      supported: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function getOptimalVideoConstraints(
  capabilities: MediaTrackCapabilities
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {};

  if (capabilities.width && capabilities.height) {
    constraints.width = {
      ideal: Math.min(1920, capabilities.width.max || 1920),
    };
    constraints.height = {
      ideal: Math.min(1080, capabilities.height.max || 1080),
    };
  }

  if (capabilities.frameRate) {
    constraints.frameRate = {
      ideal: Math.min(30, capabilities.frameRate.max || 30),
    };
  }

  if (capabilities.facingMode) {
    constraints.facingMode = { ideal: "user" };
  }

  return constraints;
}

export function getOptimalAudioConstraints(
  capabilities: MediaTrackCapabilities
): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  if (capabilities.sampleRate) {
    constraints.sampleRate = { ideal: 48000 };
  }

  if (capabilities.channelCount) {
    constraints.channelCount = { ideal: 1 };
  }

  return constraints;
}
