// src/services/DeviceManager.ts
/**
 * Device manager service
 * Manages device enumeration and selection with security controls
 */
import { authManager } from "@/services/authManager";
import Logger from "@/services/Logger";

const logger = new Logger("DeviceManager");

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  isDefault: boolean;
}

export class DeviceManager {
  private devices: MediaDeviceInfo[] = [];
  private selectedDevices: Partial<Record<MediaDeviceKind, string>> = {};

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    // Verify authentication before accessing devices
    const token = authManager.getAccessToken();
    if (!token) {
      throw new Error("Authentication required for device access");
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Filter out sensitive device information
      this.devices = devices.map((device) => ({
        deviceId: this.sanitizeDeviceId(device.deviceId),
        label: this.sanitizeLabel(device.label),
        kind: device.kind,
        isDefault: device.deviceId === "default",
      }));

      logger.debug("Devices enumerated", { count: this.devices.length });
      return this.devices;
    } catch (error) {
      logger.error("Failed to enumerate devices", error);
      throw error;
    }
  }

  private sanitizeDeviceId(deviceId: string): string {
    // Hash device IDs to prevent tracking
    return btoa(deviceId).substring(0, 16);
  }

  private sanitizeLabel(label: string): string {
    // Remove potentially sensitive info from labels
    return label.replace(/\s*\(.*?\)\s*/g, "").trim() || "Unknown Device";
  }

  selectDevice(kind: MediaDeviceKind, deviceId: string): void {
    this.selectedDevices[kind] = deviceId;
    logger.debug("Device selected", { kind, deviceId });
  }

  getSelectedDevice(kind: MediaDeviceKind): string | undefined {
    return this.selectedDevices[kind];
  }

  async hasMediaDevices(): Promise<{ audio: boolean; video: boolean }> {
    try {
      const devices = await this.enumerateDevices();
      return {
        audio: devices.some((d) => d.kind === "audioinput"),
        video: devices.some((d) => d.kind === "videoinput"),
      };
    } catch {
      return { audio: false, video: false };
    }
  }
}

export const deviceManager = new DeviceManager();
