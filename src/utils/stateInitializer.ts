// src/redux/utils/stateInitializer.ts
/**
 * State initialization utility
 * Initializes Redux state from URL parameters, cookies, and localStorage
 */
import { RootState } from "@/types";
import { URLParams } from "@/types/urls/urlParams";
import { parseURLParams } from "@/types/urls/urlParser";
import * as cookiesManager from "@/utils/cookiesManager";
import { localStorageManager } from "@/utils/localStorageManager";
import Logger from "@/services/Logger";
import { v4 as uuidv4 } from "uuid";
import deviceInfo from "@/utils/deviceInfo";

const logger = new Logger("StateInitializer");

export interface InitialState {
  room: RootState["room"];
  me: RootState["me"];
  urlParams: URLParams;
}

/**
 * Initializes application state from various sources
 * Priority: URL params > localStorage > cookies > defaults
 */
export function initializeAppState(): InitialState {
  logger.debug("Initializing app state");

  // 1. Parse URL parameters
  const urlParams = parseURLParams(window.location.href);

  // 2. Get persisted data
  const userCookie = cookiesManager.getUser();
  const devicesCookie = cookiesManager.getDevices();
  const roomSettings = localStorageManager.getRoomSettings();

  // 3. Generate IDs if needed
  const peerId = `user-${uuidv4().substring(0, 8)}`;
  const roomId = urlParams.roomId || uuidv4().substring(0, 8);

  // 4. Create room URL
  const roomUrl = createRoomUrl(roomId);

  // 5. Initialize room state
  const roomState: RootState["room"] = {
    state: "new",
    roomId,
    url: roomUrl,
    faceDetection:
      urlParams.faceDetection || roomSettings?.faceDetection || false,
    statsPeerId: null,
    mediasoupVersion: undefined,
    mediasoupClientVersion: undefined,
    mediasoupClientHandler: undefined,
  };

  // 6. Initialize me state
  const device = deviceInfo();
  const meState: RootState["me"] = {
    id: peerId,
    displayName: urlParams.displayName || userCookie?.displayName || "",
    displayNameSet: Boolean(urlParams.displayName || userCookie?.displayName),
    device,
    canSendMic: false, // Set after device check
    canSendWebcam: false, // Set after device check
    canChangeWebcam: false, // Set after device enumeration
    webcamInProgress: false,
    shareInProgress: false,
    audioOnly: urlParams.produce === false || roomSettings?.audioOnly || false,
    audioOnlyInProgress: false,
    restartIceInProgress: false,
    audioMuted: false,
    videoMuted: false,
  };

  // Apply URL parameter overrides
  if (urlParams.info) {
    (window as any).SHOW_INFO = true;
  }

  if (urlParams.throttleSecret) {
    (window as any).NETWORK_THROTTLE_SECRET = urlParams.throttleSecret;
  }

  logger.debug("State initialized", { roomState, meState, urlParams });

  return {
    room: roomState,
    me: meState,
    urlParams,
  };
}

/**
 * Creates a shareable room URL
 */
function createRoomUrl(roomId: string): string {
  const url = new URL(window.location.href);

  // Keep only essential parameters
  const params = new URLSearchParams();
  params.set("roomId", roomId);

  url.search = params.toString();
  url.hash = "";

  return url.toString();
}

/**
 * Loads persisted state from storage
 */
export function loadPersistedState(): Partial<RootState> {
  logger.debug("Loading persisted state");

  const userCookie = cookiesManager.getUser();
  const devicesCookie = cookiesManager.getDevices();
  const apiConfig = localStorageManager.getApiConfig();
  const roomSettings = localStorageManager.getRoomSettings();

  const persistedState: Partial<RootState> = {};

  // Apply persisted user settings
  if (userCookie) {
    persistedState.me = {
      ...persistedState.me,
      displayName: userCookie.displayName,
      displayNameSet: Boolean(userCookie.displayName),
    } as RootState["me"];
  }

  // Apply persisted room settings
  if (roomSettings) {
    persistedState.room = {
      ...persistedState.room,
      faceDetection: roomSettings.faceDetection || false,
    } as RootState["room"];

    if (persistedState.me) {
      persistedState.me.audioOnly = roomSettings.audioOnly || false;
    }
  }

  logger.debug("Persisted state loaded", persistedState);
  return persistedState;
}
