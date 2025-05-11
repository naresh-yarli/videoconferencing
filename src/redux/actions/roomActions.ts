// src/redux/actions/roomActions.ts
import { createAction } from "@reduxjs/toolkit";
import { RoomActionType } from "@/types";

export const setRoomState = createAction<
  "new" | "connecting" | "connected" | "closed"
>(RoomActionType.SET_ROOM_STATE);

export const setRoomActiveSpeaker = createAction<string | undefined>(
  RoomActionType.SET_ROOM_ACTIVE_SPEAKER
);

export const setRoomStatsPeerId = createAction<string | null>(
  RoomActionType.SET_ROOM_STATS_PEER_ID
);

export const setRoomFaceDetection = createAction<boolean>(
  RoomActionType.SET_ROOM_FACE_DETECTION
);

export const setRoomUrl = createAction<string>(RoomActionType.SET_ROOM_URL);

export const setMediasoupVersion = createAction<string>(
  RoomActionType.SET_MEDIASOUP_VERSION
);

export const setMediasoupClientVersion = createAction<string>(
  RoomActionType.SET_MEDIASOUP_CLIENT_VERSION
);

export const setMediasoupClientHandler = createAction<string>(
  RoomActionType.SET_MEDIASOUP_CLIENT_HANDLER
);
