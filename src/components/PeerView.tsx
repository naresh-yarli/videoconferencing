// components/PeerView.tsx
import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaDesktop,
} from "react-icons/fa";
import EditableInput from "./EditableInput";
import { Me, Peer } from "../types";
import hark from "hark";
import * as faceapi from "face-api.js";
import {
  areFaceDetectionModelsLoaded,
  detectFace,
  drawFaceDetection,
} from "../utils/faceDetection";
import { useRoom } from "@/contexts/RoomContext";

// Styled-components
const Tile = styled.div`
  background: ${theme.colors.surface};
  border-radius: ${theme.borderRadius};
  box-shadow: ${theme.shadow};
  border: 1px solid ${theme.colors.border};
  min-width: 240px;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  overflow: hidden;
`;

const Video = styled.video<{ $visible: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: ${({ $visible }) => ($visible ? "block" : "none")};
  background: ${theme.colors.placeholder};
`;

const Placeholder = styled.div`
  width: 100%;
  height: 100%;
  background: ${theme.colors.placeholder};
  color: ${theme.colors.textSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  position: absolute;
  top: 0;
  left: 0;
`;

const ControlsBar = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  gap: ${theme.spacing(1)};
  background: rgba(24, 24, 27, 0.85);
  padding: ${theme.spacing(1)} 0;
  position: absolute;
  bottom: 0;
  left: 0;
`;

const ControlButton = styled.button<{ $active?: boolean }>`
  background: ${({ $active }) =>
    $active ? theme.colors.primary : theme.colors.surface};
  color: ${({ $active }) =>
    $active ? theme.colors.text : theme.colors.textSecondary};
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  cursor: pointer;
  transition: ${theme.transition};
  &:focus {
    outline: 2px solid ${theme.colors.accent};
  }
`;

interface PeerViewProps {
  isMe?: boolean;
  peer: Me | Peer;
  audioProducerId?: string | null;
  videoProducerId?: string | null;
  audioConsumerId?: string | null;
  videoConsumerId?: string | null;
  audioRtpParameters?: any;
  videoRtpParameters?: any;
  consumerSpatialLayers?: number;
  consumerTemporalLayers?: number;
  consumerCurrentSpatialLayer?: number;
  consumerCurrentTemporalLayer?: number;
  consumerPreferredSpatialLayer?: number;
  consumerPreferredTemporalLayer?: number;
  consumerPriority?: number;
  audioTrack?: MediaStreamTrack | null;
  videoTrack?: MediaStreamTrack | null;
  audioMuted?: boolean;
  videoVisible: boolean;
  videoMultiLayer?: boolean;
  audioCodec?: string | null;
  videoCodec?: string | null;
  audioScore?: any;
  videoScore?: any;
  faceDetection?: boolean;
  onChangeDisplayName?: (displayName: string) => void;
  onChangeMaxSendingSpatialLayer?: (spatialLayer: number) => void;
  onChangeVideoPreferredLayers?: (
    spatialLayer: number,
    temporalLayer: number
  ) => void;
  onChangeVideoPriority?: (priority: number) => void;
  onRequestKeyFrame?: () => void;
  onStatsClick: (peerId: string) => void;
}

const tinyFaceDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 160,
  scoreThreshold: 0.5,
});

const PeerView: React.FC<PeerViewProps> = ({
  isMe = false,
  peer,
  audioProducerId,
  videoProducerId,
  audioConsumerId,
  videoConsumerId,
  audioRtpParameters,
  videoRtpParameters,
  consumerSpatialLayers,
  consumerTemporalLayers,
  consumerCurrentSpatialLayer,
  consumerCurrentTemporalLayer,
  consumerPreferredSpatialLayer,
  consumerPreferredTemporalLayer,
  consumerPriority,
  audioTrack,
  videoTrack,
  audioMuted,
  videoVisible,
  videoMultiLayer,
  audioCodec,
  videoCodec,
  audioScore,
  videoScore,
  faceDetection,
  onChangeDisplayName,
  onChangeMaxSendingSpatialLayer,
  onChangeVideoPreferredLayers,
  onChangeVideoPriority,
  onRequestKeyFrame,
  onStatsClick,
}) => {
  const { roomClient } = useRoom();
  const [audioVolume, setAudioVolume] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [videoResolution, setVideoResolution] = useState<{
    width: number | null;
    height: number | null;
  }>({
    width: null,
    height: null,
  });
  const [videoCanPlay, setVideoCanPlay] = useState(false);
  const [videoElemPaused, setVideoElemPaused] = useState(false);
  const [maxSpatialLayer, setMaxSpatialLayer] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const audioElemRef = useRef<HTMLAudioElement>(null);
  const videoElemRef = useRef<HTMLVideoElement>(null);
  const canvasElemRef = useRef<HTMLCanvasElement>(null);
  const rootElemRef = useRef<HTMLDivElement>(null);

  // Audio monitoring with hark
  const [harkInstance, setHarkInstance] = useState<any>(null);

  // Face detection
  const [
    faceDetectionRequestAnimationFrame,
    setFaceDetectionRequestAnimationFrame,
  ] = useState<number | null>(null);

  // Video resolution timer
  const [videoResolutionPeriodicTimer, setVideoResolutionPeriodicTimer] =
    useState<NodeJS.Timeout | null>(null);

  // Conditionally get displayNameSet for dependency array
  const meSpecificDisplayNameSet = isMe
    ? (peer as Me).displayNameSet
    : undefined;

  // Handle component mount/unmount
  useEffect(() => {
    setIsMounted(true);

    // Show tip if display name not set
    if (isMe && !(peer as Me).displayNameSet && rootElemRef.current) {
      // Show tooltip after a timeout
      const timeout = setTimeout(() => {
        // Could use React-Tooltip show() method here if needed
      }, 4000);

      return () => {
        clearTimeout(timeout);
      };
    }

    return () => {
      setIsMounted(false);
      cleanupMedia();
    };
  }, []);

  // Update the max spatial layer when videoRtpParameters change
  useEffect(() => {
    if (isMe && videoRtpParameters && maxSpatialLayer === null) {
      setMaxSpatialLayer(videoRtpParameters.encodings.length - 1);
    } else if (isMe && !videoRtpParameters && maxSpatialLayer !== null) {
      setMaxSpatialLayer(null);
    }
  }, [isMe, videoRtpParameters, maxSpatialLayer]);

  // Setup tracks when they change
  useEffect(() => {
    setTracks(audioTrack, videoTrack);

    return () => {
      cleanupMedia();
    };
  }, [audioTrack, videoTrack]);

  // Handle display name change
  useEffect(() => {
    if (isMe && meSpecificDisplayNameSet && rootElemRef.current) {
      // Hide tooltip if needed
      // React-Tooltip.hide(rootElemRef.current);
    }
  }, [isMe, meSpecificDisplayNameSet]);

  // Set up media tracks
  const setTracks = (
    newAudioTrack?: MediaStreamTrack | null,
    newVideoTrack?: MediaStreamTrack | null
  ) => {
    if (harkInstance) {
      harkInstance.stop();
      setHarkInstance(null);
    }

    stopVideoResolution();

    if (faceDetection) {
      stopFaceDetection();
    }

    const audioElem = audioElemRef.current;
    const videoElem = videoElemRef.current;

    if (!audioElem || !videoElem) {
      return;
    }

    // Handle audio track
    if (newAudioTrack) {
      const audioStream = new MediaStream();
      audioStream.addTrack(newAudioTrack);
      audioElem.srcObject = audioStream;

      audioElem.play().catch(() => {});

      runHark(audioStream);
    } else {
      audioElem.srcObject = null;
    }

    // Handle video track
    if (newVideoTrack) {
      const videoStream = new MediaStream();
      videoStream.addTrack(newVideoTrack);
      videoElem.srcObject = videoStream;

      videoElem.oncanplay = () => {
        setVideoCanPlay(true);
      };

      videoElem.onplay = () => {
        setVideoElemPaused(false);

        if (audioElem) {
          audioElem.play().catch(() => {});
        }
      };

      videoElem.onpause = () => {
        setVideoElemPaused(true);
      };

      videoElem.play().catch(() => {});

      startVideoResolution();

      if (faceDetection) {
        startFaceDetection();
      }
    } else {
      videoElem.srcObject = null;
    }
  };

  // Clean up media
  const cleanupMedia = () => {
    if (harkInstance) {
      harkInstance.stop();
      setHarkInstance(null);
    }

    stopVideoResolution();

    if (faceDetectionRequestAnimationFrame) {
      cancelAnimationFrame(faceDetectionRequestAnimationFrame);
      setFaceDetectionRequestAnimationFrame(null);
    }

    const videoElem = videoElemRef.current;

    if (videoElem) {
      videoElem.oncanplay = null;
      videoElem.onplay = null;
      videoElem.onpause = null;
    }
  };

  // Run hark for audio volume detection
  const runHark = (stream: MediaStream) => {
    if (!stream.getAudioTracks()[0]) return;

    const harkOptions = { play: false };
    const hark = require("hark");
    const instance = hark(stream, harkOptions);

    instance.on("volume_change", (dBs: number) => {
      // Convert from dBs (-100..0) to linear (0..10)
      // Exaggerate it a bit for better visual feedback
      let volume = Math.round(Math.pow(10, dBs / 85) * 10);

      // Avoid continuous 1 value as it triggers constant re-renders
      if (volume === 1) volume = 0;

      if (volume !== audioVolume) {
        setAudioVolume(volume);
      }
    });

    setHarkInstance(instance);
  };

  // Handle video resolution monitoring
  const startVideoResolution = () => {
    const videoElem = videoElemRef.current;

    if (!videoElem) return;

    const timer = setInterval(() => {
      if (
        videoElem.videoWidth !== videoResolution.width ||
        videoElem.videoHeight !== videoResolution.height
      ) {
        setVideoResolution({
          width: videoElem.videoWidth,
          height: videoElem.videoHeight,
        });
      }
    }, 500);

    setVideoResolutionPeriodicTimer(timer);
  };

  const stopVideoResolution = () => {
    if (videoResolutionPeriodicTimer) {
      clearInterval(videoResolutionPeriodicTimer);
      setVideoResolutionPeriodicTimer(null);
    }

    setVideoResolution({ width: null, height: null });
  };

  const startFaceDetection = () => {
    const videoElem = videoElemRef.current;
    const canvasElem = canvasElemRef.current;

    if (!videoElem || !canvasElem || !faceDetection) {
      return;
    }

    // Check if models are loaded
    if (!areFaceDetectionModelsLoaded()) {
      console.warn(
        "Face detection models not loaded. Face detection will be disabled."
      );
      return;
    }

    const step = async () => {
      // Make sure we still have everything we need
      if (
        !videoElemRef.current ||
        !canvasElemRef.current ||
        !videoTrack ||
        !isMounted
      ) {
        return;
      }

      // Wait for video to be ready
      if (videoElem.readyState < 2) {
        const raf = requestAnimationFrame(step);
        setFaceDetectionRequestAnimationFrame(raf);
        return;
      }

      try {
        // Detect face
        const detection = await detectFace(videoElem);

        // Draw the detection on the canvas
        drawFaceDetection(detection, canvasElem, videoElem);
      } catch (error) {
        console.error("Face detection error:", error);
        // Clear the canvas on error
        canvasElem.width = 0;
        canvasElem.height = 0;
      }

      // Schedule next detection with a small delay
      if (isMounted) {
        const raf = requestAnimationFrame(() => setTimeout(step, 100));
        setFaceDetectionRequestAnimationFrame(raf);
      }
    };

    // Start the detection loop
    step();
  };

  // Replace the stopFaceDetection method with this version
  const stopFaceDetection = () => {
    if (faceDetectionRequestAnimationFrame) {
      cancelAnimationFrame(faceDetectionRequestAnimationFrame);
      setFaceDetectionRequestAnimationFrame(null);
    }
    // Also clear any setTimeouts if used in animation frame
    // (If you use setTimeout inside requestAnimationFrame, store its id and clear it here)
    const canvasElem = canvasElemRef.current;
    if (canvasElem) {
      canvasElem.width = 0;
      canvasElem.height = 0;
    }
  };

  // Ensure cleanup on unmount and when faceDetection changes
  useEffect(() => {
    return () => {
      stopFaceDetection();
    };
  }, [faceDetection]);

  // Derive values from props/state
  const audioEnabled = !audioMuted;
  const videoEnabled = videoVisible;
  const isScreenSharing =
    videoProducerId && peer && (peer as any).producers
      ? (peer as any).producers[videoProducerId]?.type === "share"
      : false;

  // Handlers (now call RoomClient methods)
  const handleToggleAudio = async () => {
    if (!roomClient) return;
    try {
      if (audioEnabled) {
        await roomClient.muteMic();
      } else {
        await roomClient.unmuteMic();
      }
    } catch (err) {
      console.error("[PeerView.tsx] Failed to toggle audio:", err);
    }
  };

  const handleToggleVideo = async () => {
    if (!roomClient) return;
    try {
      if (videoEnabled) {
        await roomClient.disableWebcam();
      } else {
        await roomClient.enableWebcam();
      }
    } catch (err) {
      console.error("[PeerView.tsx] Failed to toggle video:", err);
    }
  };

  const handleShareScreen = async () => {
    if (!roomClient) return;
    try {
      if (isScreenSharing) {
        await roomClient.disableShare();
      } else {
        await roomClient.enableShare();
      }
    } catch (err) {
      console.error("[PeerView.tsx] Failed to toggle screen share:", err);
    }
  };

  return (
    <Tile>
      <Video
        ref={videoElemRef}
        $visible={!!videoTrack && videoEnabled}
        autoPlay
        playsInline
        muted
      />
      <audio ref={audioElemRef} autoPlay playsInline muted={isMe} />
      {/* Face detection canvas with accessibility attributes */}
      <canvas
        ref={canvasElemRef}
        className="face-detection"
        role="img"
        aria-label="Face detection overlay"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      {(!videoTrack || !videoEnabled) && (
        <Placeholder>{peer.displayName?.[0]?.toUpperCase() || "?"}</Placeholder>
      )}
      <ControlsBar>
        <ControlButton
          onClick={handleToggleAudio}
          $active={audioEnabled}
          aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {audioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
        </ControlButton>
        <ControlButton
          onClick={handleToggleVideo}
          $active={videoEnabled}
          aria-label={videoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {videoEnabled ? <FaVideo /> : <FaVideoSlash />}
        </ControlButton>
        <ControlButton
          onClick={handleShareScreen}
          $active={isScreenSharing}
          aria-label={isScreenSharing ? "Stop screen sharing" : "Share screen"}
        >
          <FaDesktop />
        </ControlButton>
      </ControlsBar>
    </Tile>
  );
};

export default PeerView;
