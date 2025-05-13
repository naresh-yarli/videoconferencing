// src/services/MediaDeviceManager.ts
/**
 * Enhanced media device manager with security controls
 * Handles device enumeration, switching, and capability detection
 */
import { authManager } from "@/services/authManager";
import Logger from "@/services/Logger";
import { EventEmitter } from "events";

const logger = new Logger("MediaDeviceManager");

export interface MediaDeviceInfo {
  deviceId: string;
  groupId: string;
  label: string;
  kind: "audioinput" | "audiooutput" | "videoinput";
  capabilities?: MediaTrackConstraints;
}

export interface MediaCapabilities {
  hasAudioInput: boolean;
  hasVideoInput: boolean;
  hasAudioOutput: boolean;
  supportedConstraints: MediaTrackSupportedConstraints;
}

export class MediaDeviceManager extends EventEmitter {
  private devices: Map<string, MediaDeviceInfo> = new Map();
  private currentDevices: {
    audioInput?: string;
    videoInput?: string;
    audioOutput?: string;
  } = {};
  private deviceChangeListener: (() => void) | null = null;

  constructor() {
    super();
    this.setupDeviceChangeListener();
  }

  private setupDeviceChangeListener(): void {
    if ("ondevicechange" in navigator.mediaDevices) {
      this.deviceChangeListener = () => {
        logger.debug("Device change detected");
        this.enumerateDevices().catch((err) =>
          logger.error("Failed to re-enumerate devices", err)
        );
      };
      navigator.mediaDevices.addEventListener(
        "devicechange",
        this.deviceChangeListener
      );
    }
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    if (!authManager.getAccessToken()) {
      throw new Error("Authentication required");
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices.clear();

      const sanitizedDevices = devices.map((device) => {
        const sanitized: MediaDeviceInfo = {
          deviceId: this.hashDeviceId(device.deviceId),
          groupId: this.hashDeviceId(device.groupId),
          label:
            this.sanitizeLabel(device.label) ||
            `${device.kind} (${device.deviceId.substring(0, 4)})`,
          kind: device.kind as MediaDeviceInfo["kind"],
        };

        this.devices.set(sanitized.deviceId, sanitized);
        return sanitized;
      });

      this.emit("deviceschanged", sanitizedDevices);
      logger.debug("Devices enumerated", { count: sanitizedDevices.length });

      return sanitizedDevices;
    } catch (error) {
      logger.error("Device enumeration failed", error);
      throw error;
    }
  }

  private hashDeviceId(id: string): string {
    // Create deterministic hash to maintain device selection across sessions
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private sanitizeLabel(label: string): string {
    return label
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "") // Remove IPs
      .replace(
        /\b[A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2}\b/gi,
        ""
      ) // Remove MACs
      .replace(/\(.*?\)/g, "") // Remove parentheses content
      .trim();
  }

  async getCapabilities(): Promise<MediaCapabilities> {
    const devices = await this.enumerateDevices();

    return {
      hasAudioInput: devices.some((d) => d.kind === "audioinput"),
      hasVideoInput: devices.some((d) => d.kind === "videoinput"),
      hasAudioOutput: devices.some((d) => d.kind === "audiooutput"),
      supportedConstraints: navigator.mediaDevices.getSupportedConstraints(),
    };
  }

  async switchCamera(deviceId: string): Promise<MediaStream> {
    if (!this.devices.has(deviceId)) {
      throw new Error("Invalid device ID");
    }

    const device = this.devices.get(deviceId)!;
    if (device.kind !== "videoinput") {
      throw new Error("Device is not a video input");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

      this.currentDevices.videoInput = deviceId;
      this.emit("cameraswitched", { deviceId, stream });

      logger.debug("Camera switched", { deviceId });
      return stream;
    } catch (error) {
      logger.error("Camera switch failed", error);
      throw error;
    }
  }

  async switchMicrophone(deviceId: string): Promise<MediaStream> {
    if (!this.devices.has(deviceId)) {
      throw new Error("Invalid device ID");
    }

    const device = this.devices.get(deviceId)!;
    if (device.kind !== "audioinput") {
      throw new Error("Device is not an audio input");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      this.currentDevices.audioInput = deviceId;
      this.emit("microphoneswitched", { deviceId, stream });

      logger.debug("Microphone switched", { deviceId });
      return stream;
    } catch (error) {
      logger.error("Microphone switch failed", error);
      throw error;
    }
  }

  async detectMicrophoneActivity(stream: MediaStream): Promise<boolean> {
    return new Promise((resolve) => {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);
      analyser.fftSize = 256;

      let detected = false;
      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;

        if (volume > 10) {
          // Threshold for audio detection
          detected = true;
        }
      };

      const interval = setInterval(checkVolume, 100);

      setTimeout(() => {
        clearInterval(interval);
        microphone.disconnect();
        audioContext.close();
        resolve(detected);
      }, 2000); // Test for 2 seconds
    });
  }

  getCurrentDevices(): typeof this.currentDevices {
    return { ...this.currentDevices };
  }

  destroy(): void {
    if (this.deviceChangeListener) {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        this.deviceChangeListener
      );
    }
    this.removeAllListeners();
    this.devices.clear();
  }
}
