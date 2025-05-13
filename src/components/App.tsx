// src/components/App.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Provider } from "react-redux";
import { store } from "@/redux/store";
import { RoomProvider, useRoom } from "@/contexts/RoomContext";
import Room from "@/components/Room";
// import { TooltipProvider } from "react-tooltip"; // Temporarily removed
import { AuthConfig as AppAuthConfig } from "@/types";

interface RoomContainerProps {
  apiUrl?: string;
  apiKey?: string; // This is the Master API Key, will be used as authToken
  roomId?: string;
  displayName?: string;
}

const RoomContainer: React.FC<RoomContainerProps> = ({
  apiUrl,
  apiKey,
  roomId,
  displayName,
}) => {
  const {
    isConnected,
    disconnect,
    error,
    isConnecting,
    connect: roomConnect,
    updateAuthConfig, // Assuming updateAuthConfig is available from RoomContext
    authConfig: currentContextAuthConfig,
  } = useRoom();

  useEffect(() => {
    console.log("[RoomContainer] Context values changed:", {
      isConnected,
      isConnecting,
      error: error ? error.message : null,
    });
  }, [isConnected, isConnecting, error]);

  useEffect(() => {
    if (
      apiUrl &&
      apiKey &&
      roomId &&
      displayName &&
      !isConnected &&
      !isConnecting &&
      !error // Only attempt if no existing error from previous attempts with these params
    ) {
      console.log("[RoomContainer] Attempting auto-connect with URL params:", {
        apiUrl,
        roomId,
        displayName,
        apiKeyIsPresent: !!apiKey,
      });
      const newAuthConfig: AppAuthConfig = { apiUrl, authToken: apiKey };

      // Update context's authConfig first, then connect
      // This ensures RoomClient is initialized with the correct config by RoomProvider
      if (updateAuthConfig) {
        // Check if authConfig needs update to prevent loops if props don't change but context does
        if (
          currentContextAuthConfig?.apiUrl !== newAuthConfig.apiUrl ||
          currentContextAuthConfig?.authToken !== newAuthConfig.authToken
        ) {
          updateAuthConfig(newAuthConfig);
        }
      } else {
        // This case should ideally not happen if RoomProvider is setup correctly
        // to provide updateAuthConfig to sync with App's master authConfig state.
        // For now, we proceed, but RoomContext might need adjustment if authConfig
        // is not correctly propagated for the RoomClient instantiation.
        console.warn(
          "[RoomContainer] updateAuthConfig not available from RoomContext. Proceeding with connect, but RoomClient might use stale authConfig if not managed by RoomProvider's authConfigParam prop."
        );
      }

      // It's crucial that RoomProvider has already processed the newAuthConfig
      // (e.g. via its own useEffect watching authConfigParam from App) before connect is called,
      // so RoomClient is instantiated with fresh authConfig.
      // The connect call itself in RoomContext uses the currentAuthConfig passed to it.
      roomConnect(roomId, displayName, newAuthConfig)
        .then(() => {
          console.log("[RoomContainer] Auto-connect successful.");
        })
        .catch((err) => {
          console.error("[RoomContainer] Auto-connect failed:", err);
          // Error is already set in RoomContext by the connect call
        });
    } else if (!isConnected && !isConnecting) {
      if (!apiUrl || !apiKey || !roomId || !displayName) {
        console.log(
          "[RoomContainer] Waiting for connection parameters from URL."
        );
      }
    }
  }, [
    apiUrl,
    apiKey,
    roomId,
    displayName,
    isConnected,
    isConnecting,
    error,
    roomConnect,
    updateAuthConfig,
    currentContextAuthConfig,
  ]);

  if (!isConnected) {
    if (isConnecting) {
      return <div>Connecting to room...</div>;
    }
    if (error) {
      return (
        <div>
          Error: {error.message}. Please check the parameters and ensure the
          server is reachable.
        </div>
      );
    }
    // If not connected, not connecting, and no error, but params are missing
    if (!apiUrl || !apiKey || !roomId || !displayName) {
      return (
        <div>
          <h1>Video Conferencing</h1>
          <p>
            Waiting for connection parameters (apiUrl, apiKey, roomId,
            displayName) from the URL.
          </p>
          <p>
            Please ensure you are launching the application with the correct
            query parameters.
          </p>
          <p>Example: ?apiUrl=...&apiKey=...&roomId=...&displayName=...</p>
        </div>
      );
    }
    // Params are present, but not connected/connecting yet (e.g. initial state before useEffect kicks in)
    return <div>Initializing...</div>;
  }

  // Connected state
  console.log(
    "[RoomContainer] Rendering Room component because isConnected is true."
  );
  return (
    <div className="room-container">
      <Room />
      <button className="leave-button" onClick={disconnect}>
        Leave Room
      </button>
    </div>
  );
};

interface AppProps {
  faceDetectionEnabled?: boolean;
}

const App: React.FC<AppProps> = ({ faceDetectionEnabled = false }) => {
  const [initialAuthParams, setInitialAuthParams] =
    useState<RoomContainerProps>({});
  const [appLevelAuthConfig, setAppLevelAuthConfig] =
    useState<AppAuthConfig | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const apiUrl = params.get("apiUrl");
    const apiKey = params.get("apiKey"); // Master API Key
    const roomId = params.get("roomId");
    const displayName = params.get("displayName");

    // const savedDisplayName = cookiesManager.getUser()?.displayName;

    const actualDisplayName = displayName; // || savedDisplayName || `User-${Math.random().toString(36).substr(2, 5)}`;

    if (apiUrl && apiKey) {
      setAppLevelAuthConfig({ apiUrl, authToken: apiKey });
    }

    setInitialAuthParams({
      apiUrl: apiUrl || undefined,
      apiKey: apiKey || undefined,
      roomId: roomId || undefined,
      displayName: actualDisplayName || undefined,
    });

    // if (actualDisplayName && !savedDisplayName) {
    //   cookiesManager.setUser({ displayName: actualDisplayName });
    // }
  }, []);

  useEffect(() => {
    if (store && store.dispatch) {
      store.dispatch({
        type: "SET_ROOM_FACE_DETECTION",
        payload: faceDetectionEnabled,
      });
    }
  }, [faceDetectionEnabled]);

  // Callback for RoomProvider to update App's master authConfig
  // This ensures App remains the source of truth for initial authConfig passed to RoomProvider
  const handleAuthConfigChange = useCallback(
    (newConfig: AppAuthConfig) => {
      // Prevent feedback loop if newConfig is same as current appLevelAuthConfig
      if (
        appLevelAuthConfig?.apiUrl !== newConfig.apiUrl ||
        appLevelAuthConfig?.authToken !== newConfig.authToken
      ) {
        console.log(
          "[App] AuthConfig changed via RoomProvider, updating App state:",
          newConfig
        );
        setAppLevelAuthConfig(newConfig);
        // Optionally, persist apiUrl if it's considered semi-permanent
        // localStorage.setItem("apiUrl", newConfig.apiUrl);
      }
    },
    [appLevelAuthConfig]
  );

  // Show loading or placeholder if essential params are not yet parsed
  if (
    !initialAuthParams.apiUrl &&
    !initialAuthParams.apiKey &&
    !initialAuthParams.roomId &&
    !initialAuthParams.displayName
  ) {
    // This check might be too simple if some params are optional or derived later.
    // For now, assumes all are needed to even attempt rendering RoomProvider meaningfully.
    const params = new URLSearchParams(window.location.search);
    if (
      !params.get("apiUrl") &&
      !params.get("apiKey") &&
      !params.get("roomId") &&
      !params.get("displayName")
    ) {
      return (
        <div>
          <h1>Video Conferencing</h1>
          <p>Loading initial parameters...</p>
          <p>
            If this persists, please check the URL for missing parameters
            (apiUrl, apiKey, roomId, displayName).
          </p>
        </div>
      );
    }
  }

  return (
    <Provider store={store}>
      {/* <TooltipProvider> */}
      <RoomProvider
        authConfigParam={appLevelAuthConfig}
        onAuthConfigSubmit={handleAuthConfigChange}
      >
        <div className="App">
          <RoomContainer
            apiUrl={initialAuthParams.apiUrl}
            apiKey={initialAuthParams.apiKey}
            roomId={initialAuthParams.roomId}
            displayName={initialAuthParams.displayName}
          />
        </div>
      </RoomProvider>
      {/* </TooltipProvider> */}
    </Provider>
  );
};

export default App;
