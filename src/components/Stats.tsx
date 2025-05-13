// components/Stats.tsx
import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import { useRoom } from "@/contexts/RoomContext";
import { RootState } from "@/redux/store";
import { Peer as PeerType, Me as MeType } from "@/types"; // Import MeType

interface StatsState {
  sendTransportRemoteStats: any;
  sendTransportLocalStats: any;
  recvTransportRemoteStats: any;
  recvTransportLocalStats: any;
  audioProducerRemoteStats: any;
  audioProducerLocalStats: any;
  videoProducerRemoteStats: any;
  videoProducerLocalStats: any;
  chatDataProducerRemoteStats: any;
  botDataProducerRemoteStats: any;
  audioConsumerRemoteStats: any;
  audioConsumerLocalStats: any;
  videoConsumerRemoteStats: any;
  videoConsumerLocalStats: any;
  chatDataConsumerRemoteStats: any;
  botDataConsumerRemoteStats: any;
}

const initialStatsState: StatsState = {
  sendTransportRemoteStats: null,
  sendTransportLocalStats: null,
  recvTransportRemoteStats: null,
  recvTransportLocalStats: null,
  audioProducerRemoteStats: null,
  audioProducerLocalStats: null,
  videoProducerRemoteStats: null,
  videoProducerLocalStats: null,
  chatDataProducerRemoteStats: null,
  botDataProducerRemoteStats: null,
  audioConsumerRemoteStats: null,
  audioConsumerLocalStats: null,
  videoConsumerRemoteStats: null,
  videoConsumerLocalStats: null,
  chatDataConsumerRemoteStats: null,
  botDataConsumerRemoteStats: null,
};

// Input selectors for stateInfo
const selectStatsPeerId = (state: RootState) => state.room.statsPeerId;
const selectMe = (state: RootState) => state.me;
const selectPeers = (state: RootState) => state.peers;
const selectConsumers = (state: RootState) => state.consumers;
const selectDataConsumers = (state: RootState) => state.dataConsumers;

// Memoized selector for stateInfo
const selectDerivedStateInfo = createSelector(
  [
    selectStatsPeerId,
    selectMe,
    selectPeers,
    selectConsumers,
    selectDataConsumers,
  ],
  (statsPeerId, me, peers, consumersMap, dataConsumersMap) => {
    if (!statsPeerId) return {};

    const isMe = statsPeerId === me.id;
    const peer: MeType | PeerType | undefined = isMe ? me : peers[statsPeerId];

    if (!peer) return {};

    let audioConsumerId: string | undefined;
    let videoConsumerId: string | undefined;
    let chatDataConsumerId: string | undefined;
    let botDataConsumerId: string | undefined;

    if (!isMe && peer && "consumers" in peer) {
      // Check if peer is of type PeerType and has consumers
      const peerAsPeerType = peer as PeerType; // Type assertion
      for (const consumerId of peerAsPeerType.consumers || []) {
        const consumer = consumersMap[consumerId];
        if (consumer?.track?.kind === "audio") {
          audioConsumerId = consumer.id;
        } else if (consumer?.track?.kind === "video") {
          videoConsumerId = consumer.id;
        }
      }
      if ("dataConsumers" in peerAsPeerType) {
        for (const dcId of peerAsPeerType.dataConsumers || []) {
          const dataConsumer = dataConsumersMap[dcId];
          if (dataConsumer?.label === "chat") {
            chatDataConsumerId = dataConsumer.id;
          } else if (dataConsumer?.label === "bot") {
            botDataConsumerId = dataConsumer.id;
          }
        }
      }
    } else if (isMe) {
      // For self (MeType), MeType does not have .consumers or .dataConsumers arrays.
      // Logic for finding botDataConsumerId for 'me' needs to be based on global dataConsumersMap
      // and potentially a link from dataConsumer back to a peerId or if it's a global bot.
      // This example assumes bot data consumers might not be directly linked to 'me' via an array on the 'me' object.
      for (const dcId of Object.keys(dataConsumersMap)) {
        const dataConsumer = dataConsumersMap[dcId];
        if (dataConsumer?.label === "bot") {
          // This simplistic approach takes the first bot data consumer found.
          // If multiple bots or specific bot association is needed, this logic needs refinement.
          botDataConsumerId = dataConsumer.id;
          break; // Assuming one bot data consumer for 'me' for now
        }
      }
    }

    return {
      peerId: peer.id,
      peerDisplayName: peer.displayName,
      isMe,
      audioConsumerId,
      videoConsumerId,
      chatDataConsumerId,
      botDataConsumerId,
    };
  }
);

const Stats: React.FC = () => {
  const { roomClient } = useRoom();
  const dispatch = useDispatch();

  const statsPeerId = useSelector(selectStatsPeerId);
  const stateInfo = useSelector(selectDerivedStateInfo);

  const [stats, setStats] = useState<StatsState>(initialStatsState);
  const [delayTimer, setDelayTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (statsPeerId && stateInfo.peerId) {
      // Check if stateInfo.peerId exists
      const timer = setTimeout(() => startCollectingStats(), 250);
      setDelayTimer(timer);
    } else if (!statsPeerId) {
      // Only stop if statsPeerId is null/undefined
      stopCollectingStats();
    }

    return () => {
      if (delayTimer) {
        clearTimeout(delayTimer);
      }
    };
  }, [statsPeerId, stateInfo.peerId]);

  useEffect(() => {
    return () => {
      stopCollectingStats();
    };
  }, []);

  const startCollectingStats = async () => {
    if (!roomClient || !statsPeerId || !stateInfo.peerId) return;

    let newStats: Partial<StatsState> = {};

    try {
      if (stateInfo.isMe) {
        newStats.sendTransportRemoteStats = await roomClient
          .getSendTransportRemoteStats()
          .catch(() => null);
        newStats.sendTransportLocalStats = await roomClient
          .getSendTransportLocalStats()
          .catch(() => null);
        newStats.recvTransportRemoteStats = await roomClient
          .getRecvTransportRemoteStats()
          .catch(() => null);
        newStats.recvTransportLocalStats = await roomClient
          .getRecvTransportLocalStats()
          .catch(() => null);
        newStats.audioProducerRemoteStats = await roomClient
          .getAudioRemoteStats()
          .catch(() => null);
        newStats.audioProducerLocalStats = await roomClient
          .getAudioLocalStats()
          .catch(() => null);
        newStats.videoProducerRemoteStats = await roomClient
          .getVideoRemoteStats()
          .catch(() => null);
        newStats.videoProducerLocalStats = await roomClient
          .getVideoLocalStats()
          .catch(() => null);
        newStats.chatDataProducerRemoteStats = await roomClient
          .getChatDataProducerRemoteStats()
          .catch(() => null);
        newStats.botDataProducerRemoteStats = await roomClient
          .getBotDataProducerRemoteStats()
          .catch(() => null);

        if (stateInfo.botDataConsumerId) {
          newStats.botDataConsumerRemoteStats = await roomClient
            .getDataConsumerRemoteStats(stateInfo.botDataConsumerId)
            .catch(() => null);
        }
      } else {
        if (stateInfo.audioConsumerId) {
          newStats.audioConsumerRemoteStats = await roomClient
            .getConsumerRemoteStats(stateInfo.audioConsumerId)
            .catch(() => null);
          newStats.audioConsumerLocalStats = await roomClient
            .getConsumerLocalStats(stateInfo.audioConsumerId)
            .catch(() => null);
        }
        if (stateInfo.videoConsumerId) {
          newStats.videoConsumerRemoteStats = await roomClient
            .getConsumerRemoteStats(stateInfo.videoConsumerId)
            .catch(() => null);
          newStats.videoConsumerLocalStats = await roomClient
            .getConsumerLocalStats(stateInfo.videoConsumerId)
            .catch(() => null);
        }
        if (stateInfo.chatDataConsumerId) {
          newStats.chatDataConsumerRemoteStats = await roomClient
            .getDataConsumerRemoteStats(stateInfo.chatDataConsumerId)
            .catch(() => null);
        }
      }
    } catch (error) {
      console.error("Error collecting stats:", error);
      // Set specific stats to error objects or handle as needed
    }

    setStats((prevStats) => ({ ...prevStats, ...newStats }));

    const timer = setTimeout(() => startCollectingStats(), 2500);
    setDelayTimer(timer);
  };

  const stopCollectingStats = () => {
    if (delayTimer) {
      clearTimeout(delayTimer);
      setDelayTimer(null);
    }
    setStats(initialStatsState);
  };

  const handleClose = () => {
    dispatch({ type: "room/setStatsPeerId", payload: null }); // Use slice action type
  };

  const renderStats = (title: string, statsData: any) => {
    // Renamed stats to statsData to avoid conflict
    const anchor = title.replace(/[ ]+/g, "-");

    let dataToRender = statsData;
    if (
      typeof statsData?.values === "function" &&
      !(statsData instanceof Map)
    ) {
      dataToRender = Array.from(statsData.values());
    } else if (statsData instanceof Map) {
      dataToRender = Array.from(statsData.entries()).map(([key, value]) => ({
        key,
        ...value,
      }));
    }

    if (
      !dataToRender ||
      (Array.isArray(dataToRender) && dataToRender.length === 0)
    ) {
      return (
        <div className="items" key={title}>
          <h2 id={anchor}>{title}</h2>
          <p>No data available.</p>
        </div>
      );
    }

    return (
      <div className="items" key={title}>
        <h2 id={anchor}>{title}</h2>
        {(Array.isArray(dataToRender) ? dataToRender : [dataToRender]).map(
          (item: any, idx: number) => (
            <div className="item" key={idx}>
              {Object.entries(item).map(([key, value]) => {
                if (typeof value === "object" && value !== null) {
                  return (
                    <div className="sub-items" key={key}>
                      <strong>{key}:</strong>
                      {Object.entries(value).map(([subKey, subValue]) => (
                        <p key={subKey} className="sub-item">
                          {subKey}: {String(subValue)}
                        </p>
                      ))}
                    </div>
                  );
                }
                return (
                  <p key={key}>
                    {key}: {String(value)}
                  </p>
                );
              })}
            </div>
          )
        )}
      </div>
    );
  };

  if (!statsPeerId || !stateInfo.peerId) {
    return null; // Don't render if no peer is selected for stats
  }

  return (
    <div className="Stats">
      <div className="header">
        <h1>Statistics for {stateInfo.peerDisplayName || statsPeerId}</h1>
        <div className="close" onClick={handleClose} />
      </div>

      <div className="content">
        {stateInfo.isMe && (
          <>
            {renderStats(
              "Send Transport (Remote)",
              stats.sendTransportRemoteStats
            )}
            {renderStats(
              "Send Transport (Local)",
              stats.sendTransportLocalStats
            )}
            {renderStats(
              "Recv Transport (Remote)",
              stats.recvTransportRemoteStats
            )}
            {renderStats(
              "Recv Transport (Local)",
              stats.recvTransportLocalStats
            )}
            {renderStats(
              "Audio Producer (Remote)",
              stats.audioProducerRemoteStats
            )}
            {renderStats(
              "Audio Producer (Local)",
              stats.audioProducerLocalStats
            )}
            {renderStats(
              "Video Producer (Remote)",
              stats.videoProducerRemoteStats
            )}
            {renderStats(
              "Video Producer (Local)",
              stats.videoProducerLocalStats
            )}
            {renderStats(
              "Chat Data Producer (Remote)",
              stats.chatDataProducerRemoteStats
            )}
            {renderStats(
              "Bot Data Producer (Remote)",
              stats.botDataProducerRemoteStats
            )}
            {stateInfo.botDataConsumerId &&
              renderStats(
                "Bot Data Consumer (Remote)",
                stats.botDataConsumerRemoteStats
              )}
          </>
        )}
        {!stateInfo.isMe && (
          <>
            {stateInfo.audioConsumerId &&
              renderStats(
                "Audio Consumer (Remote)",
                stats.audioConsumerRemoteStats
              )}
            {stateInfo.audioConsumerId &&
              renderStats(
                "Audio Consumer (Local)",
                stats.audioConsumerLocalStats
              )}
            {stateInfo.videoConsumerId &&
              renderStats(
                "Video Consumer (Remote)",
                stats.videoConsumerRemoteStats
              )}
            {stateInfo.videoConsumerId &&
              renderStats(
                "Video Consumer (Local)",
                stats.videoConsumerLocalStats
              )}
            {stateInfo.chatDataConsumerId &&
              renderStats(
                "Chat Data Consumer (Remote)",
                stats.chatDataConsumerRemoteStats
              )}
          </>
        )}
      </div>
    </div>
  );
};

export default Stats;
