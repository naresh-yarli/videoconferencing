// src/services/MediaManager.ts
/**
 * High-level media management service
 * Coordinates device selection and stream management
 */
import { MediaDeviceManager } from "./MediaDeviceManager";
import { checkMediaPermissions } from "@/utils/mediaCapabilityChecker";
import Logger from "@/services/Logger";

const logger = new Logger("MediaManager");

export class MediaManager {
  private deviceManager: MediaDeviceManager;
  private currentStreams: Map<string, MediaStream> = new Map();

  constructor() {
    this.deviceManager = new MediaDeviceManager();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.deviceManager.on("deviceschanged", () => {
      logger.debug("Devices changed, updating state");
      this.checkCapabilities();
    });
  }

  async initialize(): Promise<void> {
    await this.checkPermissions();
    await this.deviceManager.enumerateDevices();
    await this.checkCapabilities();
  }

  private async checkPermissions(): Promise<void> {
    const permissions = await checkMediaPermissions();

    if (
      permissions.camera === "denied" ||
      permissions.microphone === "denied"
    ) {
      logger.warn("Media permissions denied", permissions);
    }
  }

  private async checkCapabilities(): Promise<void> {
    const capabilities = await this.deviceManager.getCapabilities();
    logger.debug("Media capabilities", capabilities);
  }

  async startCamera(deviceId?: string): Promise<MediaStream> {
    const stream = await this.deviceManager.switchCamera(deviceId || "default");
    this.currentStreams.set("camera", stream);
    return stream;
  }

  async startMicrophone(deviceId?: string): Promise<MediaStream> {
    const stream = await this.deviceManager.switchMicrophone(
      deviceId || "default"
    );
    this.currentStreams.set("microphone", stream);
    return stream;
  }

  async switchCamera(deviceId: string): Promise<MediaStream> {
    this.stopStream("camera");
    return this.startCamera(deviceId);
  }

  async switchMicrophone(deviceId: string): Promise<MediaStream> {
    this.stopStream("microphone");
    return this.startMicrophone(deviceId);
  }

  stopStream(type: "camera" | "microphone"): void {
    const stream = this.currentStreams.get(type);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.currentStreams.delete(type);
    }
  }

  stopAllStreams(): void {
    this.currentStreams.forEach((stream, type) => {
      this.stopStream(type as "camera" | "microphone");
    });
  }

  destroy(): void {
    this.stopAllStreams();
    this.deviceManager.destroy();
  }
}

export const mediaManager = new MediaManager();
