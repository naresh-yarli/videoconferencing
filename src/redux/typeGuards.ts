// src/redux/typeGuards.ts
import {
  RoomState,
  Me,
  Peer,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
  Notification,
  Device,
  RootState,
} from "@/types";

// Room state type guards
export function isRoomState(value: any): value is RoomState {
  return (
    value &&
    typeof value === "object" &&
    ["new", "connecting", "connected", "closed"].includes(value.state) &&
    typeof value.roomId === "string" &&
    typeof value.faceDetection === "boolean"
  );
}

// Me state type guards
export function isMe(value: any): value is Me {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.displayNameSet === "boolean" &&
    isDevice(value.device) &&
    typeof value.canSendMic === "boolean" &&
    typeof value.canSendWebcam === "boolean"
  );
}

// Device type guard
export function isDevice(value: any): value is Device {
  return value && typeof value === "object" && typeof value.flag === "string";
}

// Peer type guard
export function isPeer(value: any): value is Peer {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    isDevice(value.device) &&
    Array.isArray(value.consumers) &&
    Array.isArray(value.dataConsumers)
  );
}

// Producer type guard
export function isProducer(value: any): value is Producer {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.paused === "boolean" &&
    value.track instanceof MediaStreamTrack &&
    typeof value.codec === "string"
  );
}

// Consumer type guard
export function isConsumer(value: any): value is Consumer {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.locallyPaused === "boolean" &&
    typeof value.remotelyPaused === "boolean" &&
    value.track instanceof MediaStreamTrack
  );
}

// Notification type guard
export function isNotification(value: any): value is Notification {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    ["info", "error", "warning"].includes(value.type) &&
    typeof value.text === "string"
  );
}

// State validation utilities
export function validateRootState(state: any): state is RootState {
  return (
    state &&
    isRoomState(state.room) &&
    isMe(state.me) &&
    typeof state.peers === "object" &&
    typeof state.producers === "object" &&
    typeof state.consumers === "object" &&
    typeof state.dataProducers === "object" &&
    typeof state.dataConsumers === "object" &&
    Array.isArray(state.notifications)
  );
}

// Action payload type guards
export function isMediaCapabilitiesPayload(payload: any): payload is {
  canSendMic?: boolean;
  canSendWebcam?: boolean;
  canChangeWebcam?: boolean;
} {
  return (
    payload &&
    typeof payload === "object" &&
    (payload.canSendMic === undefined ||
      typeof payload.canSendMic === "boolean") &&
    (payload.canSendWebcam === undefined ||
      typeof payload.canSendWebcam === "boolean") &&
    (payload.canChangeWebcam === undefined ||
      typeof payload.canChangeWebcam === "boolean")
  );
}

export function isProducerPausePayload(
  payload: any
): payload is { id?: string; kind?: "audio" | "video"; paused: boolean } {
  return (
    payload &&
    typeof payload === "object" &&
    typeof payload.paused === "boolean" &&
    (payload.id === undefined || typeof payload.id === "string") &&
    (payload.kind === undefined || ["audio", "video"].includes(payload.kind))
  );
}
