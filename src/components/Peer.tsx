// components/Peer.tsx
import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useRoom } from "../contexts/RoomContext";
import { RootState } from "../redux/store";
import PeerView from "./PeerView";

interface PeerProps {
  id: string;
}

const Peer: React.FC<PeerProps> = ({ id }) => {
  const { roomClient } = useRoom();
  const dispatch = useDispatch();

  const peer = useSelector((state: RootState) => state.peers[id]);
  const me = useSelector((state: RootState) => state.me);
  const consumers = useSelector((state: RootState) => {
    // Get all consumers for this peer
    const result = [];
    for (const consumerId of peer?.consumers || []) {
      const consumer = state.consumers[consumerId];
      if (consumer) {
        result.push(consumer);
      }
    }
    return result;
  });

  const faceDetection = useSelector(
    (state: RootState) => state.room.faceDetection
  );

  // Find audio and video consumers
  const audioConsumer = consumers.find(
    (consumer) => consumer.track?.kind === "audio"
  );
  const videoConsumer = consumers.find(
    (consumer) => consumer.track?.kind === "video"
  );

  // Determine if audio is enabled
  const audioEnabled =
    Boolean(audioConsumer) &&
    !audioConsumer.locallyPaused &&
    !audioConsumer.remotelyPaused;

  // Determine if video is visible
  const videoVisible =
    Boolean(videoConsumer) &&
    !videoConsumer.locallyPaused &&
    !videoConsumer.remotelyPaused;

  // Handle stats click
  const handleStatsClick = () => {
    dispatch({
      type: "SET_ROOM_STATS_PEER_ID",
      payload: id,
    });
  };

  // If peer doesn't exist, don't render
  if (!peer) {
    return null;
  }

  return (
    <div className="Peer">
      <div className="indicators">
        {!audioEnabled && <div className="icon mic-off" />}
        {!videoConsumer && <div className="icon webcam-off" />}
      </div>

      <PeerView
        peer={peer}
        audioConsumerId={audioConsumer ? audioConsumer.id : null}
        videoConsumerId={videoConsumer ? videoConsumer.id : null}
        audioRtpParameters={audioConsumer ? audioConsumer.rtpParameters : null}
        videoRtpParameters={videoConsumer ? videoConsumer.rtpParameters : null}
        consumerSpatialLayers={
          videoConsumer ? videoConsumer.spatialLayers : undefined
        }
        consumerTemporalLayers={
          videoConsumer ? videoConsumer.temporalLayers : undefined
        }
        consumerCurrentSpatialLayer={
          videoConsumer ? videoConsumer.currentSpatialLayer : undefined
        }
        consumerCurrentTemporalLayer={
          videoConsumer ? videoConsumer.currentTemporalLayer : undefined
        }
        consumerPreferredSpatialLayer={
          videoConsumer ? videoConsumer.preferredSpatialLayer : undefined
        }
        consumerPreferredTemporalLayer={
          videoConsumer ? videoConsumer.preferredTemporalLayer : undefined
        }
        consumerPriority={videoConsumer ? videoConsumer.priority : undefined}
        audioTrack={audioConsumer ? audioConsumer.track : null}
        videoTrack={videoConsumer ? videoConsumer.track : null}
        audioMuted={me.audioMuted}
        videoVisible={videoVisible}
        videoMultiLayer={
          videoConsumer && videoConsumer.spatialLayers !== undefined
        }
        audioCodec={audioConsumer ? audioConsumer.codec : null}
        videoCodec={videoConsumer ? videoConsumer.codec : null}
        audioScore={audioConsumer ? audioConsumer.score : null}
        videoScore={videoConsumer ? videoConsumer.score : null}
        faceDetection={faceDetection}
        onChangeVideoPreferredLayers={(spatialLayer, temporalLayer) => {
          if (!roomClient) return;
          roomClient.setConsumerPreferredLayers(
            videoConsumer!.id,
            spatialLayer,
            temporalLayer
          );
        }}
        onChangeVideoPriority={(priority) => {
          if (!roomClient) return;
          roomClient.setConsumerPriority(videoConsumer!.id, priority);
        }}
        onRequestKeyFrame={() => {
          if (!roomClient) return;
          roomClient.requestConsumerKeyFrame(videoConsumer!.id);
        }}
        onStatsClick={handleStatsClick}
      />
    </div>
  );
};

export default Peer;
