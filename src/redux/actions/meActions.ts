// src/redux/actions/meActions.ts (complete version)
import { createAction } from "@reduxjs/toolkit";
import { MeActionType, Me } from "@/types";

export const setMe = createAction<Partial<Me>>(MeActionType.SET_ME);

export const setMediaCapabilities = createAction<{
  canSendMic?: boolean;
  canSendWebcam?: boolean;
  canChangeWebcam?: boolean;
}>(MeActionType.SET_MEDIA_CAPABILITIES);

export const setCanChangeWebcam = createAction<boolean>(
  MeActionType.SET_CAN_CHANGE_WEBCAM
);

export const setDisplayName = createAction<{
  displayName: string;
  displayNameSet: boolean;
}>(MeActionType.SET_DISPLAY_NAME);

export const setWebcamInProgress = createAction<boolean>(
  MeActionType.SET_WEBCAM_IN_PROGRESS
);

export const setShareInProgress = createAction<boolean>(
  MeActionType.SET_SHARE_IN_PROGRESS
);

export const setAudioOnly = createAction<boolean>(MeActionType.SET_AUDIO_ONLY);

export const setAudioOnlyInProgress = createAction<boolean>(
  MeActionType.SET_AUDIO_ONLY_IN_PROGRESS
);

export const setRestartIceInProgress = createAction<boolean>(
  MeActionType.SET_RESTART_ICE_IN_PROGRESS
);

export const setAudioMuted = createAction<boolean>(
  MeActionType.SET_AUDIO_MUTED
);

export const setAudioMutedState = createAction<boolean>(
  MeActionType.SET_AUDIO_MUTED_STATE
);

export const setVideoMuted = createAction<boolean>(
  MeActionType.SET_VIDEO_MUTED
);

export const setVideoMutedState = createAction<boolean>(
  MeActionType.SET_VIDEO_MUTED_STATE
);
