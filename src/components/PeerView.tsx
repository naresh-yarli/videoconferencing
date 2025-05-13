// components/PeerView.tsx
import React, { useState, useEffect, useRef } from "react";
import classnames from "classnames";
import EditableInput from "./EditableInput";
import { Me, Peer } from "../types";
import hark from "hark";
import * as faceapi from "face-api.js";
import {
  areFaceDetectionModelsLoaded,
  detectFace,
  drawFaceDetection,
} from "../utils/faceDetection";

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

    if (!audioElem || !videoElem) return;

    // Handle audio track
    if (newAudioTrack) {
      const audioStream = new MediaStream();
      audioStream.addTrack(newAudioTrack);
      audioElem.srcObject = audioStream;

      audioElem
        .play()
        .catch((error) => console.warn("audioElem.play() failed:", error));

      runHark(audioStream);
    } else {
      audioElem.srcObject = null;
    }

    // Handle video track
    if (newVideoTrack) {
      console.log(
        "[PeerView] setTracks - videoTrack:",
        newVideoTrack
          ? {
              id: newVideoTrack.id,
              kind: newVideoTrack.kind,
              readyState: newVideoTrack.readyState,
              enabled: newVideoTrack.enabled,
              muted: newVideoTrack.muted,
            }
          : null
      );
      const videoStream = new MediaStream();
      videoStream.addTrack(newVideoTrack);
      videoElem.srcObject = videoStream;

      videoElem.oncanplay = () => {
        console.log(
          "[PeerView] oncanplay FIRED. Setting videoCanPlay to true. videoTrack:",
          videoTrack ? videoTrack.id : null
        );
        setVideoCanPlay(true);
      };

      videoElem.onplay = () => {
        console.log(
          "[PeerView] onplay FIRED. videoTrack:",
          videoTrack ? videoTrack.id : null
        );
        setVideoElemPaused(false);

        if (audioElem) {
          audioElem
            .play()
            .catch((error) => console.warn("audioElem.play() failed:", error));
        }
      };

      videoElem.onpause = () => setVideoElemPaused(true);

      videoElem
        .play()
        .catch((error) => console.warn("videoElem.play() failed:", error));

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

    const canvasElem = canvasElemRef.current;

    if (canvasElem) {
      canvasElem.width = 0;
      canvasElem.height = 0;
    }
  };

  // Helper for printing producer score
  const printProducerScore = (id: string, score: any) => {
    const scores = Array.isArray(score) ? score : [score];

    return (
      <React.Fragment key={id}>
        <p>streams:</p>

        {scores
          .filter((v) => v)
          .sort((a, b) => {
            if (a.rid) return a.rid > b.rid ? 1 : -1;
            else return a.ssrc > b.ssrc ? 1 : -1;
          })
          .map((s, idx) => (
            <p key={idx} className="indent">
              {s.rid !== undefined
                ? `rid:${s.rid}, ssrc:${s.ssrc}, score:${s.score}`
                : `ssrc:${s.ssrc}, score:${s.score}`}
            </p>
          ))}
      </React.Fragment>
    );
  };

  // Helper for printing consumer score
  const printConsumerScore = (id: string, score: any) => {
    return (
      <p key={id}>
        {`score:${score.score}, producerScore:${score.producerScore}, producerScores:[${score.producerScores}]`}
      </p>
    );
  };

  return (
    <div className="PeerView" ref={rootElemRef}>
      {console.log(
        "[PeerView] Rendering. isMe:",
        isMe,
        "videoVisible:",
        videoVisible,
        "videoCanPlay:",
        videoCanPlay,
        "videoTrack:",
        videoTrack ? videoTrack.id : null
      )}
      <div className="info">
        <div className="icons">
          <div
            className={classnames("icon", "info", { on: showInfo })}
            onClick={() => setShowInfo(!showInfo)}
          />

          <div className="icon stats" onClick={() => onStatsClick(peer.id)} />
        </div>

        <div className={classnames("box", { visible: showInfo })}>
          {/* Audio info */}
          {(audioProducerId || audioConsumerId) && (
            <>
              <h1>audio</h1>

              {audioProducerId && (
                <p>
                  {"id: "}
                  <span
                    className="copiable"
                    data-tip="Copy audio producer id to clipboard"
                    onClick={() =>
                      navigator.clipboard.writeText(audioProducerId)
                    }
                  >
                    {audioProducerId}
                  </span>
                </p>
              )}

              {audioConsumerId && (
                <p>
                  {"id: "}
                  <span
                    className="copiable"
                    data-tip="Copy audio consumer id to clipboard"
                    onClick={() =>
                      navigator.clipboard.writeText(audioConsumerId)
                    }
                  >
                    {audioConsumerId}
                  </span>
                </p>
              )}

              {audioCodec && <p>codec: {audioCodec}</p>}

              {audioProducerId &&
                audioScore &&
                printProducerScore(audioProducerId, audioScore)}

              {audioConsumerId &&
                audioScore &&
                printConsumerScore(audioConsumerId, audioScore)}
            </>
          )}

          {/* Video info */}
          {(videoProducerId || videoConsumerId) && (
            <>
              <h1>video</h1>

              {videoProducerId && (
                <p>
                  {"id: "}
                  <span
                    className="copiable"
                    data-tip="Copy video producer id to clipboard"
                    onClick={() =>
                      navigator.clipboard.writeText(videoProducerId)
                    }
                  >
                    {videoProducerId}
                  </span>
                </p>
              )}

              {videoConsumerId && (
                <p>
                  {"id: "}
                  <span
                    className="copiable"
                    data-tip="Copy video consumer id to clipboard"
                    onClick={() =>
                      navigator.clipboard.writeText(videoConsumerId)
                    }
                  >
                    {videoConsumerId}
                  </span>
                </p>
              )}

              {videoCodec && <p>codec: {videoCodec}</p>}

              {videoVisible &&
                videoResolution.width &&
                videoResolution.height && (
                  <p>
                    resolution: {videoResolution.width}x{videoResolution.height}
                  </p>
                )}

              {/* Spatial Layers controls for producers */}
              {videoVisible &&
                videoProducerId &&
                videoRtpParameters?.encodings.length > 1 && (
                  <p>
                    max spatial layer:{" "}
                    {maxSpatialLayer !== null && maxSpatialLayer > -1
                      ? maxSpatialLayer
                      : "none"}
                    <span> </span>
                    <span
                      className={classnames({
                        clickable:
                          maxSpatialLayer !== null && maxSpatialLayer > -1,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();

                        if (
                          maxSpatialLayer === null ||
                          maxSpatialLayer < 0 ||
                          !onChangeMaxSendingSpatialLayer
                        )
                          return;

                        const newMaxSpatialLayer = maxSpatialLayer - 1;

                        onChangeMaxSendingSpatialLayer(newMaxSpatialLayer);
                        setMaxSpatialLayer(newMaxSpatialLayer);
                      }}
                    >
                      {"[ down ]"}
                    </span>
                    <span> </span>
                    <span
                      className={classnames({
                        clickable:
                          maxSpatialLayer !== null &&
                          videoRtpParameters &&
                          maxSpatialLayer <
                            videoRtpParameters.encodings.length - 1,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();

                        if (
                          maxSpatialLayer === null ||
                          !videoRtpParameters ||
                          maxSpatialLayer >=
                            videoRtpParameters.encodings.length - 1 ||
                          !onChangeMaxSendingSpatialLayer
                        )
                          return;

                        const newMaxSpatialLayer = maxSpatialLayer + 1;

                        onChangeMaxSendingSpatialLayer(newMaxSpatialLayer);
                        setMaxSpatialLayer(newMaxSpatialLayer);
                      }}
                    >
                      {"[ up ]"}
                    </span>
                  </p>
                )}

              {/* Layer controls for consumers */}
              {!isMe && videoMultiLayer && (
                <>
                  <p>
                    {`current spatial-temporal layers: ${
                      consumerCurrentSpatialLayer !== undefined
                        ? consumerCurrentSpatialLayer
                        : "none"
                    } ${
                      consumerCurrentTemporalLayer !== undefined
                        ? consumerCurrentTemporalLayer
                        : "none"
                    }`}
                  </p>
                  <p>
                    {`preferred spatial-temporal layers: ${
                      consumerPreferredSpatialLayer !== undefined
                        ? consumerPreferredSpatialLayer
                        : "none"
                    } ${
                      consumerPreferredTemporalLayer !== undefined
                        ? consumerPreferredTemporalLayer
                        : "none"
                    }`}
                    <span> </span>
                    <span
                      className="clickable"
                      onClick={(event) => {
                        event.stopPropagation();

                        if (
                          !onChangeVideoPreferredLayers ||
                          consumerPreferredSpatialLayer === undefined ||
                          consumerPreferredTemporalLayer === undefined ||
                          consumerSpatialLayers === undefined ||
                          consumerTemporalLayers === undefined
                        )
                          return;

                        let newPreferredSpatialLayer =
                          consumerPreferredSpatialLayer;
                        let newPreferredTemporalLayer;

                        if (consumerPreferredTemporalLayer > 0) {
                          newPreferredTemporalLayer =
                            consumerPreferredTemporalLayer - 1;
                        } else {
                          if (consumerPreferredSpatialLayer > 0) {
                            newPreferredSpatialLayer =
                              consumerPreferredSpatialLayer - 1;
                          } else {
                            newPreferredSpatialLayer =
                              consumerSpatialLayers - 1;
                          }

                          newPreferredTemporalLayer =
                            consumerTemporalLayers - 1;
                        }

                        onChangeVideoPreferredLayers(
                          newPreferredSpatialLayer,
                          newPreferredTemporalLayer
                        );
                      }}
                    >
                      {"[ down ]"}
                    </span>
                    <span> </span>
                    <span
                      className="clickable"
                      onClick={(event) => {
                        event.stopPropagation();

                        if (
                          !onChangeVideoPreferredLayers ||
                          consumerPreferredSpatialLayer === undefined ||
                          consumerPreferredTemporalLayer === undefined ||
                          consumerSpatialLayers === undefined ||
                          consumerTemporalLayers === undefined
                        )
                          return;

                        let newPreferredSpatialLayer =
                          consumerPreferredSpatialLayer;
                        let newPreferredTemporalLayer;

                        if (
                          consumerPreferredTemporalLayer <
                          consumerTemporalLayers - 1
                        ) {
                          newPreferredTemporalLayer =
                            consumerPreferredTemporalLayer + 1;
                        } else {
                          if (
                            consumerPreferredSpatialLayer <
                            consumerSpatialLayers - 1
                          ) {
                            newPreferredSpatialLayer =
                              consumerPreferredSpatialLayer + 1;
                          } else {
                            newPreferredSpatialLayer = 0;
                          }

                          newPreferredTemporalLayer = 0;
                        }

                        onChangeVideoPreferredLayers(
                          newPreferredSpatialLayer,
                          newPreferredTemporalLayer
                        );
                      }}
                    >
                      {"[ up ]"}
                    </span>
                  </p>
                </>
              )}

              {/* Priority controls for consumers */}
              {!isMe &&
                videoCodec &&
                consumerPriority !== undefined &&
                consumerPriority > 0 && (
                  <p>
                    {`priority: ${consumerPriority}`}
                    <span> </span>
                    <span
                      className={classnames({
                        clickable: consumerPriority > 1,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();

                        if (!onChangeVideoPriority || consumerPriority <= 1)
                          return;

                        onChangeVideoPriority(consumerPriority - 1);
                      }}
                    >
                      {"[ down ]"}
                    </span>
                    <span> </span>
                    <span
                      className={classnames({
                        clickable: consumerPriority < 255,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();

                        if (!onChangeVideoPriority || consumerPriority >= 255)
                          return;

                        onChangeVideoPriority(consumerPriority + 1);
                      }}
                    >
                      {"[ up ]"}
                    </span>
                  </p>
                )}

              {/* Keyframe request for consumers */}
              {!isMe && videoCodec && onRequestKeyFrame && (
                <p>
                  <span
                    className="clickable"
                    onClick={(event) => {
                      event.stopPropagation();

                      onRequestKeyFrame();
                    }}
                  >
                    {"[ request keyframe ]"}
                  </span>
                </p>
              )}

              {videoProducerId &&
                videoScore &&
                printProducerScore(videoProducerId, videoScore)}

              {videoConsumerId &&
                videoScore &&
                printConsumerScore(videoConsumerId, videoScore)}
            </>
          )}
        </div>

        <div className={classnames("peer", { "is-me": isMe })}>
          {isMe ? (
            <EditableInput
              value={peer.displayName || ""}
              propName="displayName"
              className="display-name editable"
              classLoading="loading"
              classInvalid="invalid"
              editProps={{
                maxLength: 20,
                autoCorrect: "false",
                spellCheck: "false",
              }}
              onChange={({ displayName }) => {
                if (onChangeDisplayName) {
                  onChangeDisplayName(displayName);
                }
              }}
            />
          ) : (
            <span className="display-name">{peer.displayName}</span>
          )}

          <div className="row">
            <span className={classnames("device-icon", peer.device.flag)} />
            <span className="device-version">
              {peer.device.name} {peer.device.version || null}
            </span>
          </div>
        </div>
      </div>

      <video
        ref={videoElemRef}
        className={classnames({
          "is-me": isMe,
          hidden: !videoVisible || !videoCanPlay,
          "network-error":
            videoVisible &&
            videoMultiLayer &&
            consumerCurrentSpatialLayer === null,
        })}
        autoPlay
        playsInline
        muted
        controls={false}
      />

      <audio
        ref={audioElemRef}
        autoPlay
        muted={isMe || audioMuted}
        controls={false}
      />

      <canvas
        ref={canvasElemRef}
        className={classnames("face-detection", { "is-me": isMe })}
      />

      <div className="volume-container">
        <div className={classnames("bar", `level${audioVolume}`)} />
      </div>

      {videoVisible && videoScore && videoScore < 5 && (
        <div className="spinner-container">
          <div className="spinner" />
        </div>
      )}

      {videoElemPaused && <div className="video-elem-paused" />}
    </div>
  );
};

export default PeerView;
