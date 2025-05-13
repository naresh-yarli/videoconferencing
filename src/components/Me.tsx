// src/components/Me.tsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRoom } from "@/contexts/RoomContext";
import { RootState } from "@/types";
import PeerView from "@/components/PeerView";
import * as cookiesManager from "@/utils/cookiesManager";
import { CodecSelector } from "./CodecSelector";

// Type for browser permission state (if not available from lib.dom.d.ts)
type PermissionState = "granted" | "denied" | "prompt";

// Simple debounce utility
function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastPromise: Promise<any> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    return new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        lastPromise = fn(...args)
          .then(resolve)
          .catch(reject);
      }, delay);
    });
  };
}

// Simple debounce utility for async functions
function useDebouncedAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
) {
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>();
  return React.useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay]
  );
}

const Me: React.FC = () => {
  const { roomClient } = useRoom();
  const dispatch = useDispatch();

  const room = useSelector((state: RootState) => state.room);
  const connected = room.state === "connected";
  const me = useSelector((state: RootState) => state.me);
  const producers = useSelector((state: RootState) => state.producers);
  const faceDetection = room.faceDetection;

  // Get audio/video producers
  const producersArray = Object.values(producers);
  const audioProducer = producersArray.find(
    (producer) => producer.track && producer.track.kind === "audio"
  );
  const videoProducer = producersArray.find(
    (producer) => producer.track && producer.track.kind === "video"
  );

  // Permission and track state
  const [micPermission, setMicPermission] = useState<PermissionState | null>(
    null
  );
  const [camPermission, setCamPermission] = useState<PermissionState | null>(
    null
  );
  const [micTrackState, setMicTrackState] = useState<string | null>(null);
  const [camTrackState, setCamTrackState] = useState<string | null>(null);
  const [micDeviceError, setMicDeviceError] = useState<string | null>(null);
  const [camDeviceError, setCamDeviceError] = useState<string | null>(null);
  const [micInProgress, setMicInProgress] = useState(false);
  const [webcamInProgress, setWebcamInProgress] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);

  // Monitor permissions
  useEffect(() => {
    let micPerm: PermissionStatus | null = null;
    let camPerm: PermissionStatus | null = null;
    let micListener: (() => void) | null = null;
    let camListener: (() => void) | null = null;

    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          setMicPermission(status.state);
          micPerm = status;
          micListener = () => setMicPermission(status.state);
          status.addEventListener("change", micListener);
        });
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((status) => {
          setCamPermission(status.state);
          camPerm = status;
          camListener = () => setCamPermission(status.state);
          status.addEventListener("change", camListener);
        });
    }
    return () => {
      if (micPerm && micListener)
        micPerm.removeEventListener("change", micListener);
      if (camPerm && camListener)
        camPerm.removeEventListener("change", camListener);
    };
  }, []);

  // Monitor track state and errors
  useEffect(() => {
    let audioTrack = audioProducer?.track as MediaStreamTrack | undefined;
    let videoTrack = videoProducer?.track as MediaStreamTrack | undefined;
    if (audioTrack) {
      setMicTrackState(audioTrack.readyState);
      const handleEnded = () => setMicTrackState("ended");
      const handleMute = () => setMicTrackState("muted");
      const handleUnmute = () => setMicTrackState("live");
      audioTrack.addEventListener("ended", handleEnded);
      audioTrack.addEventListener("mute", handleMute);
      audioTrack.addEventListener("unmute", handleUnmute);
      return () => {
        audioTrack.removeEventListener("ended", handleEnded);
        audioTrack.removeEventListener("mute", handleMute);
        audioTrack.removeEventListener("unmute", handleUnmute);
      };
    }
  }, [audioProducer]);
  useEffect(() => {
    let videoTrack = videoProducer?.track as MediaStreamTrack | undefined;
    if (videoTrack) {
      setCamTrackState(videoTrack.readyState);
      const handleEnded = () => setCamTrackState("ended");
      const handleMute = () => setCamTrackState("muted");
      const handleUnmute = () => setCamTrackState("live");
      videoTrack.addEventListener("ended", handleEnded);
      videoTrack.addEventListener("mute", handleMute);
      videoTrack.addEventListener("unmute", handleUnmute);
      return () => {
        videoTrack.removeEventListener("ended", handleEnded);
        videoTrack.removeEventListener("mute", handleMute);
        videoTrack.removeEventListener("unmute", handleUnmute);
      };
    }
  }, [videoProducer]);

  // Memoize all derived media/UI state to avoid flicker during Redux transitions
  const { micState, webcamState, changeWebcamState, shareState, videoVisible } =
    useMemo(() => {
      // Determine mic state
      let micState: "unsupported" | "on" | "off" | "denied" | "error";
      if (micPermission === "denied") micState = "denied";
      else if (!me.canSendMic) micState = "unsupported";
      else if (micTrackState === "ended") micState = "error";
      else if (!audioProducer) micState = "off";
      else if (!audioProducer.paused && micTrackState === "live")
        micState = "on";
      else micState = "off";

      // Determine webcam state
      let webcamState: "unsupported" | "on" | "off" | "denied" | "error";
      if (camPermission === "denied") webcamState = "denied";
      else if (!me.canSendWebcam) webcamState = "unsupported";
      else if (camTrackState === "ended") webcamState = "error";
      else if (
        videoProducer &&
        videoProducer.type !== "share" &&
        camTrackState === "live"
      )
        webcamState = "on";
      else webcamState = "off";

      // Determine change webcam state
      let changeWebcamState: "on" | "unsupported";
      if (
        Boolean(videoProducer) &&
        videoProducer?.type !== "share" &&
        me.canChangeWebcam
      ) {
        changeWebcamState = "on";
      } else {
        changeWebcamState = "unsupported";
      }

      // Determine share state
      let shareState: "on" | "off";
      if (Boolean(videoProducer) && videoProducer?.type === "share") {
        shareState = "on";
      } else {
        shareState = "off";
      }

      // Determine if video is visible
      const videoVisible = videoProducer ? !videoProducer.paused : false;

      return {
        micState,
        webcamState,
        changeWebcamState,
        shareState,
        videoVisible,
      };
    }, [
      micPermission,
      camPermission,
      me,
      audioProducer,
      micTrackState,
      videoProducer,
      camTrackState,
    ]);

  // Local transitioning state to mask flicker during Redux transitions
  const [transitioning, setTransitioning] = useState(false);

  // Set transitioning true on control click, false when Redux state matches expected
  useEffect(() => {
    if (
      micInProgress ||
      webcamInProgress ||
      me.webcamInProgress ||
      me.shareInProgress
    ) {
      setTransitioning(true);
    } else {
      setTransitioning(false);
    }
  }, [
    micInProgress,
    webcamInProgress,
    me.webcamInProgress,
    me.shareInProgress,
  ]);

  // Show display name tip if not set
  const tip = !me.displayNameSet
    ? "Click on your name to change it"
    : undefined;

  // Show error/warning if permission denied or device error
  const mediaWarning =
    micState === "denied" || webcamState === "denied"
      ? "Camera or microphone permission denied. Please check your browser settings."
      : micState === "error" || webcamState === "error"
      ? "Camera or microphone disconnected or not working."
      : null;

  // Comprehensive loading/empty state logic
  let loadingMessage: string | null = null;
  if (room.state === "connecting") {
    loadingMessage = "Connecting to room...";
  } else if (micPermission === "prompt" || camPermission === "prompt") {
    loadingMessage = "Requesting camera/microphone permissions...";
  } else if (micPermission === "denied" || camPermission === "denied") {
    loadingMessage =
      "Camera or microphone permission denied. Please check your browser settings.";
  } else if (!audioProducer && !videoProducer) {
    loadingMessage =
      "No media tracks available. Please enable your camera and microphone.";
  } else if (
    (audioProducer && micTrackState !== "live") ||
    (videoProducer && camTrackState !== "live")
  ) {
    loadingMessage = "Waiting for media devices to become ready...";
  }

  // Handle stats view
  const handleStatsClick = () => {
    if (!roomClient) return;

    dispatch({
      type: "SET_ROOM_STATS_PEER_ID",
      payload: me.id,
    });
  };

  // Debounced handlers for mic and webcam
  const debouncedMicHandler = useDebouncedAsync(async () => {
    if (!roomClient || micInProgress) return;
    setControlError(null);
    setMicInProgress(true);
    try {
      if (micState === "on") {
        await roomClient.muteMic();
      } else {
        await roomClient.unmuteMic();
      }
    } catch (err) {
      setControlError("Failed to toggle microphone. Please try again.");
      console.error("[Me.tsx] Mic control error:", err);
    } finally {
      setMicInProgress(false);
    }
  }, 300);

  const debouncedWebcamHandler = useDebouncedAsync(async () => {
    if (
      !roomClient ||
      webcamInProgress ||
      micInProgress ||
      me.webcamInProgress ||
      me.shareInProgress
    )
      return;
    setControlError(null);
    setWebcamInProgress(true);
    try {
      if (webcamState === "on") {
        await roomClient.disableWebcam();
      } else {
        await roomClient.enableWebcam();
      }
    } catch (err) {
      setControlError("Failed to toggle webcam. Please try again.");
      console.error("[Me.tsx] Webcam control error:", err);
    } finally {
      setWebcamInProgress(false);
    }
  }, 300);

  return (
    <div className="Me" data-tip={tip}>
      {(micPermission === "denied" || camPermission === "denied") && (
        <div
          className="media-permission-error"
          style={{
            color: "red",
            marginBottom: 16,
            fontWeight: 600,
            fontSize: 16,
            background: "#fff3f3",
            border: "1px solid #ffcccc",
            borderRadius: 6,
            padding: 16,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>Camera or Microphone Permission Denied</strong>
          </div>
          <div style={{ marginBottom: 8 }}>
            This application cannot access your camera or microphone.
            <br />
            Please allow access in your browser settings and reload the page.
          </div>
          <ul style={{ marginBottom: 8, paddingLeft: 20, fontSize: 14 }}>
            <li>Check for a camera/mic icon in your browser's address bar.</li>
            <li>Click it and select "Allow" for both camera and microphone.</li>
            <li>Reload this page after changing permissions.</li>
          </ul>
          <button
            style={{
              padding: "6px 16px",
              borderRadius: 4,
              border: "none",
              background: "#ff4d4f",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      )}
      {controlError && (
        <div
          className="media-warning"
          style={{ color: "red", marginBottom: 8 }}
        >
          {controlError}
        </div>
      )}
      {mediaWarning && (
        <div
          className="media-warning"
          style={{ color: "red", marginBottom: 8 }}
        >
          {mediaWarning}
        </div>
      )}
      {loadingMessage ? (
        <div
          className="media-loading"
          style={{ color: "#888", marginBottom: 8 }}
        >
          {loadingMessage}
        </div>
      ) : (
        <>
          {connected && (
            <div className="controls">
              <div
                className={`button mic ${micState} ${
                  micInProgress || transitioning ? "disabled" : ""
                }`}
                onClick={debouncedMicHandler}
              >
                {micInProgress ? (
                  <span
                    className="spinner"
                    style={{
                      width: 18,
                      height: 18,
                      display: "inline-block",
                      border: "2px solid #ccc",
                      borderTop: "2px solid #333",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                ) : null}
              </div>

              <div
                className={`button webcam ${webcamState} ${
                  micInProgress ||
                  webcamInProgress ||
                  me.webcamInProgress ||
                  me.shareInProgress ||
                  transitioning
                    ? "disabled"
                    : ""
                }`}
                onClick={debouncedWebcamHandler}
              >
                {webcamInProgress ? (
                  <span
                    className="spinner"
                    style={{
                      width: 18,
                      height: 18,
                      display: "inline-block",
                      border: "2px solid #ccc",
                      borderTop: "2px solid #333",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                ) : null}
              </div>

              <div
                className={`button change-webcam ${changeWebcamState} ${
                  micInProgress ||
                  webcamInProgress ||
                  me.webcamInProgress ||
                  me.shareInProgress ||
                  transitioning
                    ? "disabled"
                    : ""
                }`}
                onClick={() => {
                  if (!roomClient) return;

                  roomClient.changeWebcam();
                }}
              />

              <div
                className={`button share ${shareState} ${
                  micInProgress ||
                  webcamInProgress ||
                  me.shareInProgress ||
                  me.webcamInProgress ||
                  transitioning
                    ? "disabled"
                    : ""
                }`}
                onClick={() => {
                  if (!roomClient) return;

                  if (shareState === "on") {
                    roomClient.disableShare();
                  } else {
                    roomClient.enableShare();
                  }
                }}
              />
            </div>
          )}

          <PeerView
            isMe={true}
            peer={me}
            audioProducerId={audioProducer ? audioProducer.id : null}
            videoProducerId={videoProducer ? videoProducer.id : null}
            audioRtpParameters={
              audioProducer ? audioProducer.rtpParameters : null
            }
            videoRtpParameters={
              videoProducer ? videoProducer.rtpParameters : null
            }
            audioTrack={audioProducer ? audioProducer.track : null}
            videoTrack={videoProducer ? videoProducer.track : null}
            videoVisible={videoVisible}
            audioCodec={audioProducer ? audioProducer.codec : null}
            videoCodec={videoProducer ? videoProducer.codec : null}
            audioScore={audioProducer ? audioProducer.score : null}
            videoScore={videoProducer ? videoProducer.score : null}
            faceDetection={faceDetection}
            onChangeDisplayName={(displayName) => {
              if (!roomClient) return;
              roomClient.changeDisplayName(displayName);
            }}
            onChangeMaxSendingSpatialLayer={(spatialLayer) => {
              if (!roomClient) return;
              roomClient.setMaxSendingSpatialLayer(spatialLayer);
            }}
            onStatsClick={handleStatsClick}
          />
        </>
      )}
    </div>
  );
};

export default Me;
