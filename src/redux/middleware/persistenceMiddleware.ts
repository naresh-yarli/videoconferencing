// src/redux/middleware/persistenceMiddleware.ts
/**
 * Redux persistence middleware
 * Syncs specific state slices to localStorage/cookies
 */
import { Middleware } from "@reduxjs/toolkit";
import { RootState } from "@/types";
import * as cookiesManager from "@/utils/cookiesManager";
import { localStorageManager } from "@/utils/localStorageManager";
import Logger from "@/services/Logger";

const logger = new Logger("PersistenceMiddleware");

const PERSIST_CONFIG = {
  cookies: ["displayName", "webcamEnabled", "micEnabled"],
  localStorage: ["apiUrl", "apiKey", "roomSettings"],
  debounceMs: 500,
};

let debounceTimers: Record<string, NodeJS.Timeout> = {};

export const persistenceMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action) => {
    const result = next(action);
    const state = store.getState();

    // Debounce persistence to avoid excessive writes
    Object.keys(debounceTimers).forEach((key) =>
      clearTimeout(debounceTimers[key])
    );

    debounceTimers.cookies = setTimeout(() => {
      persistToCookies(state);
    }, PERSIST_CONFIG.debounceMs);

    debounceTimers.localStorage = setTimeout(() => {
      persistToLocalStorage(state);
    }, PERSIST_CONFIG.debounceMs);

    return result;
  };

function persistToCookies(state: RootState): void {
  // Only persist non-sensitive user preferences
  cookiesManager.setUser({
    displayName: state.me.displayName,
  });
}

function persistToLocalStorage(state: RootState): void {
  // Only persist non-sensitive preferences
  localStorageManager.setUserPreferences({
    audioOnly: state.me.audioOnly,
    faceDetection: state.room.faceDetection,
    lastRoomId: state.room.roomId,
  });
}
