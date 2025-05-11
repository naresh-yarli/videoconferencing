// src/components/Me.tsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRoom } from "@/contexts/RoomContext";
import { RootState } from "@/types";
import PeerView from "@/components/PeerView";
import * as cookiesManager from "@/utils/cookiesManager";

const Me: React.FC = () => {
  const { roomClient } = useRoom();
  const dispatch = useDispatch();

  const connected = useSelector(
    (state: RootState) => state.room.state === "connected"
  );
  const me = useSelector((state: RootState) => state.me);
  const producers = useSelector((state: RootState) => state.producers);
  const faceDetection = useSelector(
    (state: RootState) => state.room.faceDetection
  );

  // Get audio/video producers
  const producersArray = Object.values(producers);
  const audioProducer = producersArray.find(
    (producer) => producer.track.kind === "audio"
  );
  const videoProducer = producersArray.find(
    (producer) => producer.track.kind === "video"
  );

  // Determine mic state
  let micState: "unsupported" | "on" | "off";

  if (!me.canSendMic) micState = "unsupported";
  else if (!audioProducer) micState = "off";
  else if (!audioProducer.paused) micState = "on";
  else micState = "off";

  // Determine webcam state
  let webcamState: "unsupported" | "on" | "off";

  if (!me.canSendWebcam) webcamState = "unsupported";
  else if (videoProducer && videoProducer.type !== "share") webcamState = "on";
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

  // Show display name tip if not set
  const tip = !me.displayNameSet
    ? "Click on your name to change it"
    : undefined;

  // Handle stats view
  const handleStatsClick = () => {
    if (!roomClient) return;

    dispatch({
      type: "SET_ROOM_STATS_PEER_ID",
      payload: me.id,
    });
  };

  return (
    <div className="Me" data-tip={tip}>
      {connected && (
        <div className="controls">
          <div
            className={`button mic ${micState}`}
            onClick={() => {
              if (!roomClient) return;

              micState === "on" ? roomClient.muteMic() : roomClient.unmuteMic();
            }}
          />

          <div
            className={`button webcam ${webcamState} ${
              me.webcamInProgress || me.shareInProgress ? "disabled" : ""
            }`}
            onClick={() => {
              if (!roomClient) return;

              if (webcamState === "on") {
                cookiesManager.setDevices({ webcamEnabled: false });
                roomClient.disableWebcam();
              } else {
                cookiesManager.setDevices({ webcamEnabled: true });
                roomClient.enableWebcam();
              }
            }}
          />

          <div
            className={`button change-webcam ${changeWebcamState} ${
              me.webcamInProgress || me.shareInProgress ? "disabled" : ""
            }`}
            onClick={() => {
              if (!roomClient) return;

              roomClient.changeWebcam();
            }}
          />

          <div
            className={`button share ${shareState} ${
              me.shareInProgress || me.webcamInProgress ? "disabled" : ""
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
        audioRtpParameters={audioProducer ? audioProducer.rtpParameters : null}
        videoRtpParameters={videoProducer ? videoProducer.rtpParameters : null}
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
    </div>
  );
};

export default Me;
