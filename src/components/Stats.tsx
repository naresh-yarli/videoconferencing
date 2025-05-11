// components/Stats.tsx
import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useRoom } from "@/contexts/RoomContext";
import { RootState } from "@/redux/store";

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

const Stats: React.FC = () => {
  const { roomClient } = useRoom();
  const dispatch = useDispatch();

  // Get state
  const statsPeerId = useSelector((state: RootState) => state.room.statsPeerId);

  // Get peer info if a peer ID is selected
  const stateInfo = useSelector((state: RootState) => {
    if (!statsPeerId) return {};

    const isMe = statsPeerId === state.me.id;
    const peer = isMe ? state.me : state.peers[statsPeerId];

    // If the peer doesn't exist, return empty object
    if (!peer) return {};

    // Get audio/video consumers for this peer
    let audioConsumerId;
    let videoConsumerId;
    let chatDataConsumerId;
    let botDataConsumerId;

    if (!isMe) {
      // Find consumers for this peer
      for (const consumerId of peer.consumers || []) {
        const consumer = state.consumers[consumerId];
        if (consumer?.track?.kind === "audio") {
          audioConsumerId = consumer.id;
        } else if (consumer?.track?.kind === "video") {
          videoConsumerId = consumer.id;
        }
      }

      // Find data consumers for this peer
      for (const dataConsumerId of peer.dataConsumers || []) {
        const dataConsumer = state.dataConsumers[dataConsumerId];
        if (dataConsumer?.label === "chat") {
          chatDataConsumerId = dataConsumer.id;
        } else if (dataConsumer?.label === "bot") {
          botDataConsumerId = dataConsumer.id;
        }
      }
    } else {
      // For self, find data consumers with bot label
      for (const dataConsumerId of Object.keys(state.dataConsumers)) {
        const dataConsumer = state.dataConsumers[dataConsumerId];
        if (dataConsumer?.label === "bot") {
          botDataConsumerId = dataConsumer.id;
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
  });

  // Stats collection state
  const [stats, setStats] = useState<StatsState>(initialStatsState);
  const [delayTimer, setDelayTimer] = useState<NodeJS.Timeout | null>(null);

  // Reset stats when peer changes
  useEffect(() => {
    if (statsPeerId) {
      // Start collecting stats with a small delay
      const timer = setTimeout(() => startCollectingStats(), 250);
      setDelayTimer(timer);
    } else {
      stopCollectingStats();
    }

    return () => {
      if (delayTimer) {
        clearTimeout(delayTimer);
      }
    };
  }, [statsPeerId, stateInfo.peerId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCollectingStats();
    };
  }, []);

  // Start collecting stats
  const startCollectingStats = async () => {
    if (!roomClient || !statsPeerId) return;

    let newStats: Partial<StatsState> = {};

    if (stateInfo.isMe) {
      // Collect stats for our own producers and transports
      newStats.sendTransportRemoteStats = await roomClient
        .getTransportStats("send")
        .catch(() => null);
      newStats.sendTransportLocalStats = await roomClient
        .getTransportLocalStats("send")
        .catch(() => null);
      newStats.recvTransportRemoteStats = await roomClient
        .getTransportStats("recv")
        .catch(() => null);
      newStats.recvTransportLocalStats = await roomClient
        .getTransportLocalStats("recv")
        .catch(() => null);

      newStats.audioProducerRemoteStats = await roomClient
        .getAudioStats()
        .catch(() => null);
      newStats.audioProducerLocalStats = await roomClient
        .getAudioLocalStats()
        .catch(() => null);

      newStats.videoProducerRemoteStats = await roomClient
        .getVideoStats()
        .catch(() => null);
      newStats.videoProducerLocalStats = await roomClient
        .getVideoLocalStats()
        .catch(() => null);

      newStats.chatDataProducerRemoteStats = await roomClient
        .getChatDataProducerStats()
        .catch(() => null);
      newStats.botDataProducerRemoteStats = await roomClient
        .getBotDataProducerStats()
        .catch(() => null);

      if (stateInfo.botDataConsumerId) {
        newStats.botDataConsumerRemoteStats = await roomClient
          .getDataConsumerStats(stateInfo.botDataConsumerId)
          .catch(() => null);
      }
    } else {
      // Collect stats for consumers
      if (stateInfo.audioConsumerId) {
        newStats.audioConsumerRemoteStats = await roomClient
          .getConsumerStats(stateInfo.audioConsumerId)
          .catch(() => null);
        newStats.audioConsumerLocalStats = await roomClient
          .getConsumerLocalStats(stateInfo.audioConsumerId)
          .catch(() => null);
      }

      if (stateInfo.videoConsumerId) {
        newStats.videoConsumerRemoteStats = await roomClient
          .getConsumerStats(stateInfo.videoConsumerId)
          .catch(() => null);
        newStats.videoConsumerLocalStats = await roomClient
          .getConsumerLocalStats(stateInfo.videoConsumerId)
          .catch(() => null);
      }

      if (stateInfo.chatDataConsumerId) {
        newStats.chatDataConsumerRemoteStats = await roomClient
          .getDataConsumerStats(stateInfo.chatDataConsumerId)
          .catch(() => null);
      }
    }

    setStats((prevStats) => ({ ...prevStats, ...newStats }));

    // Schedule the next stats collection
    const timer = setTimeout(() => startCollectingStats(), 2500);
    setDelayTimer(timer);
  };

  // Stop collecting stats
  const stopCollectingStats = () => {
    if (delayTimer) {
      clearTimeout(delayTimer);
      setDelayTimer(null);
    }

    setStats(initialStatsState);
  };

  // Close stats
  const handleClose = () => {
    dispatch({
      type: "SET_ROOM_STATS_PEER_ID",
      payload: null,
    });
  };

  // Render stats
  const renderStats = (title: string, stats: any) => {
    const anchor = title.replace(/[ ]+/g, "-");

    if (typeof stats?.values === "function") {
      stats = Array.from(stats.values());
    }

    return (
      <div className="items" key={title}>
        <h2 id={anchor}>{title}</h2>

        {stats.map((item: any, idx: number) => (
          <div className="item" key={idx}>
            {Object.keys(item).map((key) => (
              <div className="line" key={key}>
                <p className="key">{key}</p>
                <div className="value">
                  <pre>
                    {typeof item[key] === "number"
                      ? JSON.stringify(
                          Math.round(item[key] * 100) / 100,
                          null,
                          "  "
                        )
                      : JSON.stringify(item[key], null, "  ")}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // If no peer is selected, don't render
  if (!statsPeerId) {
    return null;
  }

  const {
    sendTransportRemoteStats,
    sendTransportLocalStats,
    recvTransportRemoteStats,
    recvTransportLocalStats,
    audioProducerRemoteStats,
    audioProducerLocalStats,
    videoProducerRemoteStats,
    videoProducerLocalStats,
    chatDataProducerRemoteStats,
    botDataProducerRemoteStats,
    audioConsumerRemoteStats,
    audioConsumerLocalStats,
    videoConsumerRemoteStats,
    videoConsumerLocalStats,
    chatDataConsumerRemoteStats,
    botDataConsumerRemoteStats,
  } = stats;

  return (
    <div className="Stats">
      <div className={`content ${statsPeerId ? "visible" : ""}`}>
        <div className="header">
          <div className="info">
            <div className="close-icon" onClick={handleClose} />

            {stateInfo.isMe ? (
              <h1>Your Stats</h1>
            ) : (
              <h1>Stats of {stateInfo.peerDisplayName}</h1>
            )}
          </div>

          <div className="list">
            {/* Transport stats links */}
            {(sendTransportRemoteStats || sendTransportLocalStats) && (
              <p>
                {"send transport stats: "}
                <a href="#send-transport-remote-stats">[remote]</a>
                <span> </span>
                <a href="#send-transport-local-stats">[local]</a>
              </p>
            )}

            {(recvTransportRemoteStats || recvTransportLocalStats) && (
              <p>
                {"recv transport stats: "}
                <a href="#recv-transport-remote-stats">[remote]</a>
                <span> </span>
                <a href="#recv-transport-local-stats">[local]</a>
              </p>
            )}

            {/* Producer stats links */}
            {(audioProducerRemoteStats || audioProducerLocalStats) && (
              <p>
                {"audio producer stats: "}
                <a href="#audio-producer-remote-stats">[remote]</a>
                <span> </span>
                <a href="#audio-producer-local-stats">[local]</a>
              </p>
            )}

            {(videoProducerRemoteStats || videoProducerLocalStats) && (
              <p>
                {"video producer stats: "}
                <a href="#video-producer-remote-stats">[remote]</a>
                <span> </span>
                <a href="#video-producer-local-stats">[local]</a>
              </p>
            )}

            {/* Data producer stats links */}
            {chatDataProducerRemoteStats && (
              <p>
                {"chat dataproducer stats: "}
                <a href="#chat-dataproducer-remote-stats">[remote]</a>
                <span> </span>
                <a className="disabled">[local]</a>
              </p>
            )}

            {botDataProducerRemoteStats && (
              <p>
                {"bot dataproducer stats: "}
                <a href="#bot-dataproducer-remote-stats">[remote]</a>
                <span> </span>
                <a className="disabled">[local]</a>
              </p>
            )}

            {/* Consumer stats links */}
            {(audioConsumerRemoteStats || audioConsumerLocalStats) && (
              <p>
                {"audio consumer stats: "}
                <a href="#audio-consumer-remote-stats">[remote]</a>
                <span> </span>
                <a href="#audio-consumer-local-stats">[local]</a>
              </p>
            )}

            {(videoConsumerRemoteStats || videoConsumerLocalStats) && (
              <p>
                {"video consumer stats: "}
                <a href="#video-consumer-remote-stats">[remote]</a>
                <span> </span>
                <a href="#video-consumer-local-stats">[local]</a>
              </p>
            )}

            {/* Data consumer stats links */}
            {chatDataConsumerRemoteStats && (
              <p>
                {"chat dataconsumer stats: "}
                <a href="#chat-dataconsumer-remote-stats">[remote]</a>
                <span> </span>
                <a className="disabled">[local]</a>
              </p>
            )}

            {botDataConsumerRemoteStats && (
              <p>
                {"bot dataconsumer stats: "}
                <a href="#bot-dataconsumer-remote-stats">[remote]</a>
                <span> </span>
                <a className="disabled">[local]</a>
              </p>
            )}
          </div>
        </div>

        <div className="stats">
          {/* Render transport stats */}
          {sendTransportRemoteStats &&
            renderStats(
              "send transport remote stats",
              sendTransportRemoteStats
            )}
          {sendTransportLocalStats &&
            renderStats("send transport local stats", sendTransportLocalStats)}
          {recvTransportRemoteStats &&
            renderStats(
              "recv transport remote stats",
              recvTransportRemoteStats
            )}
          {recvTransportLocalStats &&
            renderStats("recv transport local stats", recvTransportLocalStats)}

          {/* Render producer stats */}
          {audioProducerRemoteStats &&
            renderStats(
              "audio producer remote stats",
              audioProducerRemoteStats
            )}
          {audioProducerLocalStats &&
            renderStats("audio producer local stats", audioProducerLocalStats)}
          {videoProducerRemoteStats &&
            renderStats(
              "video producer remote stats",
              videoProducerRemoteStats
            )}
          {videoProducerLocalStats &&
            renderStats("video producer local stats", videoProducerLocalStats)}

          {/* Render data producer stats */}
          {chatDataProducerRemoteStats &&
            renderStats(
              "chat dataproducer remote stats",
              chatDataProducerRemoteStats
            )}
          {botDataProducerRemoteStats &&
            renderStats(
              "bot dataproducer remote stats",
              botDataProducerRemoteStats
            )}

          {/* Render consumer stats */}
          {audioConsumerRemoteStats &&
            renderStats(
              "audio consumer remote stats",
              audioConsumerRemoteStats
            )}
          {audioConsumerLocalStats &&
            renderStats("audio consumer local stats", audioConsumerLocalStats)}
          {videoConsumerRemoteStats &&
            renderStats(
              "video consumer remote stats",
              videoConsumerRemoteStats
            )}
          {videoConsumerLocalStats &&
            renderStats("video consumer local stats", videoConsumerLocalStats)}

          {/* Render data consumer stats */}
          {chatDataConsumerRemoteStats &&
            renderStats(
              "chat dataconsumer remote stats",
              chatDataConsumerRemoteStats
            )}
          {botDataConsumerRemoteStats &&
            renderStats(
              "bot dataconsumer remote stats",
              botDataConsumerRemoteStats
            )}
        </div>
      </div>
    </div>
  );
};

export default Stats;
