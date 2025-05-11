// src/components/App.tsx
import React, { useState, useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/redux/store";
import { RoomProvider, useRoom } from "@/contexts/RoomContext";
import Room from "@/components/Room";
import * as cookiesManager from "@/utils/cookiesManager";
import { v4 as uuidv4 } from "uuid";
import { TooltipProvider } from "react-tooltip";

const AuthForm: React.FC = () => {
  const { connect, isConnecting, error } = useRoom();

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [roomId, setRoomId] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Load stored values if available
  useEffect(() => {
    // Try to get display name from cookie
    const user = cookiesManager.getUser();
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }

    // Generate random room ID if not in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdParam = urlParams.get("roomId");

    if (roomIdParam) {
      setRoomId(roomIdParam);
    } else {
      setRoomId(uuidv4().slice(0, 8));
    }

    // Set API URL from local storage if available
    const savedApiUrl = localStorage.getItem("apiUrl");
    if (savedApiUrl) {
      setApiUrl(savedApiUrl);
    }

    // Set API Key from local storage if available
    const savedApiKey = localStorage.getItem("apiKey");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // Update URL when room ID changes
  useEffect(() => {
    if (roomId) {
      const url = new URL(window.location.href);
      url.searchParams.set("roomId", roomId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [roomId]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiUrl || !apiKey || !roomId || !displayName) {
      alert("Please fill in all fields");
      return;
    }

    // Save values
    cookiesManager.setUser({ displayName });
    localStorage.setItem("apiUrl", apiUrl);
    localStorage.setItem("apiKey", apiKey);

    // Connect to room
    try {
      await connect(roomId, displayName);
    } catch (error) {
      console.error("Failed to connect to room", error);
    }
  };

  // Generate random room ID
  const handleGenerateRoomId = () => {
    setRoomId(uuidv4().slice(0, 8));
  };

  // Generate random display name
  const handleGenerateDisplayName = () => {
    const adjectives = [
      "Happy",
      "Sleepy",
      "Grumpy",
      "Sneezy",
      "Dopey",
      "Bashful",
      "Doc",
    ];
    const nouns = [
      "Tiger",
      "Lion",
      "Bear",
      "Elephant",
      "Zebra",
      "Monkey",
      "Giraffe",
    ];

    const randomAdjective =
      adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

    setDisplayName(`${randomAdjective}${randomNoun}`);
  };

  return (
    <div className="auth-form">
      <h1>Video Conferencing</h1>

      {error && <div className="error-message">{error.message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="apiUrl">API URL</label>
          <input
            type="text"
            id="apiUrl"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="apiKey">API Key</label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your API key"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="roomId">Room ID</label>
          <div className="input-with-button">
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Room ID"
              required
            />
            <button type="button" onClick={handleGenerateRoomId}>
              Generate
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="displayName">Display Name</label>
          <div className="input-with-button">
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
            />
            <button type="button" onClick={handleGenerateDisplayName}>
              Generate
            </button>
          </div>
        </div>

        <button type="submit" className="join-button" disabled={isConnecting}>
          {isConnecting ? "Connecting..." : "Join Room"}
        </button>
      </form>
    </div>
  );
};

const RoomContainer: React.FC = () => {
  const { isConnected, disconnect } = useRoom();

  if (!isConnected) {
    return <AuthForm />;
  }

  return (
    <div className="room-container">
      <Room />

      <button className="leave-button" onClick={disconnect}>
        Leave Room
      </button>
    </div>
  );
};
// Update the App component props to include face detection enabled flag
interface AppProps {
  faceDetectionEnabled?: boolean;
}

const App: React.FC<AppProps> = ({ faceDetectionEnabled = false }) => {
  const [authConfig, setAuthConfig] = useState({
    apiUrl: "",
    apiKey: "",
  });

  // Initialize auth config from local storage
  useEffect(() => {
    const apiUrl = localStorage.getItem("apiUrl") || "";
    const apiKey = localStorage.getItem("apiKey") || "";

    setAuthConfig({ apiUrl, apiKey });
    // Set face detection state based on whether models loaded successfully
    if (store && store.dispatch) {
      store.dispatch({
        type: "SET_ROOM_FACE_DETECTION",
        payload: faceDetectionEnabled,
      });
    }
  }, [faceDetectionEnabled]);

  return (
    <Provider store={store}>
      <RoomProvider authConfig={authConfig}>
        <div className="App">
          <RoomContainer />
        </div>
      </RoomProvider>
    </Provider>
  );
};

export default App;
