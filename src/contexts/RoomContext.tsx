// src/contexts/RoomContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { RoomClient } from "@/services/RoomClient";
import {
  AuthConfig as AppAuthConfig,
  Device as TypesDevice,
  RootState as AppRootState,
  AppDispatch,
} from "@/types";
import { roomActions, meActions, requestActions } from "@/redux/store"; // Ensure correct path
import Logger from "@/services/Logger"; // Import Logger
import deviceInfo from "@/utils/deviceInfo"; // Import deviceInfo

// Define the shape of the context value
export interface RoomContextValue {
  roomClient: RoomClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  authConfig: AppAuthConfig | null; // Updated to use AppAuthConfig and allow null
  connect: (
    roomId: string,
    displayName: string,
    currentAuthConfig: AppAuthConfig // Use AppAuthConfig
  ) => Promise<void>;
  disconnect: () => void;
  updateAuthConfig: (newConfig: AppAuthConfig) => void; // Added for updating App's state
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export interface RoomProviderProps {
  children: ReactNode;
  authConfigParam: AppAuthConfig | null; // Prop from App component
  onAuthConfigSubmit: (newConfig: AppAuthConfig) => void; // Callback to update App's state
}

const logger = new Logger("RoomProvider"); // Initialize logger for the provider

export const RoomProvider: React.FC<RoomProviderProps> = ({
  children,
  authConfigParam, // Use the prop
  onAuthConfigSubmit, // Use the callback
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const roomClientRef = useRef<RoomClient | null>(null);
  const peerIdRef = useRef<string>("");
  const storeRef = useRef<any>({ dispatch }); // Minimal store ref for RoomClient
  const [localAuthConfig, setLocalAuthConfig] = useState<AppAuthConfig | null>(
    authConfigParam
  );

  const [error, setError] = useState<Error | null>(null);

  // Select relevant parts of the Redux state
  const roomStateFromRedux = useSelector(
    (state: AppRootState) => state.room.state
  );
  const meIdFromRedux = useSelector((state: AppRootState) => state.me.id);

  // Derive connection states from Redux state
  const isConnecting = roomStateFromRedux === "connecting";
  const isConnected = roomStateFromRedux === "connected";

  useEffect(() => {
    setLocalAuthConfig(authConfigParam);
  }, [authConfigParam]);

  useEffect(() => {
    logger.debug("RoomProvider State update:", {
      roomStateFromRedux,
      isConnectedDerived: isConnected,
      isConnectingDerived: isConnecting,
      errorLocalState: error ? error.message : null,
    });
  }, [roomStateFromRedux, isConnected, isConnecting, error]);

  const updateAuthConfigHandler = useCallback(
    (newConfig: AppAuthConfig) => {
      setLocalAuthConfig(newConfig);
      onAuthConfigSubmit(newConfig); // Call the callback to update App state
    },
    [onAuthConfigSubmit]
  );

  const connect = useCallback(
    async (
      roomId: string,
      displayName: string,
      currentAuthConfig: AppAuthConfig
    ) => {
      // Redact token before logging
      const loggedAuthConfig = {
        ...currentAuthConfig,
        authToken: currentAuthConfig.authToken ? "[REDACTED]" : undefined,
      };
      logger.info(
        `RoomContext: connect called with roomId: ${roomId}, displayName: ${displayName}`,
        {
          currentAuthConfig: loggedAuthConfig,
        }
      );

      if (
        !currentAuthConfig ||
        !currentAuthConfig.apiUrl ||
        !currentAuthConfig.authToken
      ) {
        logger.error(
          "Connect called without full authConfig (API URL or AuthToken missing)"
        );
        setError(new Error("API URL and Auth Token are required to connect."));
        dispatch(roomActions.setRoomState("closed"));
        return;
      }

      // Ensure localAuthConfig is updated if RoomContainer calls connect directly with new auth details
      // This might happen if RoomContainer's handleAuthSubmit calls connect before App state fully propagates
      if (
        localAuthConfig?.apiUrl !== currentAuthConfig.apiUrl ||
        localAuthConfig?.authToken !== currentAuthConfig.authToken
      ) {
        updateAuthConfigHandler(currentAuthConfig);
      }

      dispatch(roomActions.setRoomState("connecting"));
      setError(null);

      if (!(window as any).APP_DEVICE) {
        (window as any).APP_DEVICE = deviceInfo();
        logger.info("APP_DEVICE initialized in connect", {
          device: (window as any).APP_DEVICE,
        });
        dispatch(
          meActions.setMediaCapabilities({
            canSendMic: true, // Assuming default capabilities
            canSendWebcam: true,
          })
        );
      }

      const peerId = `user-${uuidv4().slice(0, 8)}`;
      peerIdRef.current = peerId;
      dispatch(
        meActions.setMe({
          id: peerId,
          displayName,
          device: (window as any).APP_DEVICE,
        })
      );

      const newRoomClient = new RoomClient({
        roomId,
        peerId,
        displayName,
        device: (window as any).APP_DEVICE,
        store: storeRef.current,
        authConfig: currentAuthConfig,
      });

      roomClientRef.current = newRoomClient;

      // Setup event listeners for RoomClient
      newRoomClient.on("notification", (notification) => {
        dispatch(
          requestActions.notify({
            text: notification.text || JSON.stringify(notification),
            type: notification.type || "info",
            timeout: notification.timeout || 3000,
          })
        );
      });

      newRoomClient.on("disconnected", (reason?: string) => {
        logger.warn(
          `RoomClient 'disconnected' event: ${reason || "No reason provided"}`
        );
        dispatch(roomActions.setRoomState("closed"));
        setError(new Error(`Disconnected: ${reason || "Connection closed"}`));
        roomClientRef.current = null;
      });

      newRoomClient.on("error", (err: Error) => {
        logger.error("RoomClient 'error' event:", err);
        dispatch(roomActions.setRoomState("closed"));
        setError(err);
        roomClientRef.current = null;
      });

      newRoomClient.on("connected", () => {
        logger.info("RoomClient 'connected' event received in RoomProvider.");
        dispatch(roomActions.setRoomState("connected"));
      });

      try {
        await newRoomClient.join();
        roomClientRef.current = newRoomClient;
      } catch (err: any) {
        logger.error("Error during connect process:", err);
        setError(err);
        dispatch(roomActions.setRoomState("closed"));
      }
    },
    [dispatch, localAuthConfig, updateAuthConfigHandler]
  );

  const disconnect = useCallback(() => {
    logger.info("RoomContext: disconnect called");
    if (roomClientRef.current) {
      roomClientRef.current.close();
      roomClientRef.current = null;
    }
    dispatch(roomActions.setRoomState("closed"));
    setError(null);
  }, [dispatch]);

  const contextValue: RoomContextValue = {
    roomClient: roomClientRef.current,
    isConnected,
    isConnecting,
    error,
    authConfig: localAuthConfig,
    connect,
    disconnect,
    updateAuthConfig: updateAuthConfigHandler,
  };

  return (
    <RoomContext.Provider value={contextValue}>{children}</RoomContext.Provider>
  );
};

export const useRoom = (): RoomContextValue => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
};

// Higher order component for class components
export const withRoomContext = (Component: React.ComponentType<any>) => {
  return (props: any) => {
    const roomContext = useRoom();
    return <Component {...props} roomClient={roomContext.roomClient} />;
  };
};

export default RoomContext;
