// src/redux/actions/deviceActions.ts
/**
 * Device-related Redux actions
 */
import { createAction } from "@reduxjs/toolkit";
import { DeviceInfo } from "@/types/device";

export const setDeviceInfo = createAction<DeviceInfo>("device/setInfo");
export const setMediaCapabilities = createAction<{
  canSendMic: boolean;
  canSendWebcam: boolean;
  canChangeWebcam: boolean;
}>("device/setMediaCapabilities");
export const setDevicePermissions = createAction<{
  audio: boolean;
  video: boolean;
}>("device/setPermissions");
