// src/utils/localStorageManager.ts (updated - no sensitive data)
/**
 * LocalStorage for non-sensitive user preferences only
 */
export interface UserPreferences {
  theme?: "light" | "dark";
  language?: string;
  audioOnly?: boolean;
  faceDetection?: boolean;
  lastRoomId?: string; // Non-sensitive
}

class LocalStorageManager {
  getUserPreferences(): UserPreferences | null {
    try {
      const data = localStorage.getItem("videoconference_preferences");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setUserPreferences(prefs: UserPreferences): void {
    try {
      localStorage.setItem(
        "videoconference_preferences",
        JSON.stringify(prefs)
      );
    } catch (error) {
      console.error("Failed to save preferences", error);
    }
  }
}

export const localStorageManager = new LocalStorageManager();
