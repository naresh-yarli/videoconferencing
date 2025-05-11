// src/contexts/RoomContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { AuthConfig } from "../types";
import deviceInfo from "../utils/deviceInfo";

// Import RoomClient using relative path to avoid circular dependencies
import { RoomClient } from "../services/RoomClient";

// For this version we'll use direct imports instead of path aliases
// to prevent any import resolution issues
import { RootState, AppDispatch } from "@/types";
import { requestActions } from "@/redux/store";

// Create the room context
interface RoomContextProps {
  roomClient: RoomClient | null;
  isConnecting: boolean;
  isConnected: boolean;
  connect: (roomId: string, displayName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  error: Error | null;
}

const RoomContext = createContext<RoomContextProps>({
  roomClient: null,
  isConnecting: false,
  isConnected: false,
  connect: async () => {},
  disconnect: async () => {},
  reconnect: async () => {},
  error: null,
});

// Create the provider component
interface RoomProviderProps {
  children: React.ReactNode;
  authConfig: AuthConfig;
}

export const RoomProvider: React.FC<RoomProviderProps> = ({
  children,
  authConfig,
}) => {
  const [roomClient, setRoomClient] = useState<RoomClient | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const roomState = useSelector((state: RootState) => state.room.state);
  const isConnected = roomState === "connected";

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (roomClient) {
        roomClient.close();
      }
    };
  }, [roomClient]);

  const connect = async (
    roomId: string,
    displayName: string
  ): Promise<void> => {
    if (isConnecting || isConnected) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Create a new room client
      const peerId = `user-${uuidv4().substring(0, 8)}`;
      const device = deviceInfo();

      // Read 'produce' URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const produceParam = urlParams.get("produce");
      // Default to true if param is not present or not explicitly "false"
      const shouldProduce = produceParam !== "false";
      // Log whether producing is enabled
      console.log(
        `RoomContext: Initializing RoomClient with produce=${shouldProduce}`
      );

      const client = new RoomClient({
        roomId,
        peerId,
        displayName,
        device,
        authConfig,
        produce: shouldProduce, // Pass the determined produce flag
        store: {
          dispatch,
        },
      });

      // Set up event listeners
      client.on("notification", (notification) => {
        dispatch(
          requestActions.notify({
            type: notification.type || "info",
            text: notification.text || "Unknown notification",
            timeout: notification.timeout || 5000,
          })
        );
      });

      client.on("joinFailed", (error) => {
        setError(
          error instanceof Error ? error : new Error("Failed to join room")
        );
        setIsConnecting(false);
      });

      // Join the room
      await client.join();

      // Save the client
      setRoomClient(client);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to connect to room")
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!roomClient) {
      return;
    }

    try {
      await roomClient.leave();
      setRoomClient(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to disconnect from room")
      );
    }
  };

  const reconnect = async (): Promise<void> => {
    if (!roomClient) {
      return;
    }

    try {
      // Try to reconnect
      await roomClient.close();
      await roomClient.join();
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to reconnect to room")
      );
    }
  };

  const value: RoomContextProps = {
    roomClient,
    isConnecting,
    isConnected,
    connect,
    disconnect,
    reconnect,
    error,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

// Create a custom hook to use the room context
export const useRoom = (): RoomContextProps => {
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
