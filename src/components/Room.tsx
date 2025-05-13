// src/components/Room.tsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRoom } from "@/contexts/RoomContext";
import { RootState, requestActions } from "@/redux/store";
import { copyToClipboard } from "@/utils/clipboard";
import Me from "@/components/Me";
import Peers from "@/components/Peers";
import ChatInput from "@/components/ChatInput";
import Notifications from "@/components/Notifications";
import Stats from "@/components/Stats";
import { CodecSelector } from "./CodecSelector";

const Room: React.FC = () => {
  const { roomClient, isConnected } = useRoom();
  const dispatch = useDispatch();

  const room = useSelector((state: RootState) => state.room);
  const me = useSelector((state: RootState) => state.me);
  const amActiveSpeaker = useSelector(
    (state: RootState) => state.room.activeSpeakerId === state.me.id
  );

  // Handle room link copy
  const handleRoomLinkCopy = () => {
    if (room.url) {
      copyToClipboard(room.url)
        .then(() => {
          dispatch<any>(
            requestActions.notify({
              type: "info",
              text: "Room link copied to clipboard",
              timeout: 3000,
            })
          );
        })
        .catch((error) => {
          console.error("Failed to copy room link", error);
          dispatch<any>(
            requestActions.notify({
              type: "error",
              text: "Failed to copy room link",
              timeout: 3000,
            })
          );
        });
    }
  };

  // Get the mediasoup client version
  const mediasoupClientVersion =
    room.mediasoupClientVersion === "__MEDIASOUP_CLIENT_VERSION__"
      ? "dev"
      : room.mediasoupClientVersion;

  return (
    <div className="Room">
      <Notifications />

      <div className="state">
        <div className={`icon ${room.state}`} />
        <p className={`text ${room.state}`}>{room.state}</p>
      </div>
      <div className="sidebar">
        {/* Add CodecSelector above existing controls */}
        <CodecSelector />

        <div
          className={`button hide-videos ${me.audioOnly ? "on" : ""} ${
            me.audioOnlyInProgress ? "disabled" : ""
          }`}
          data-tip="Show/hide participants' video"
          onClick={() => {
            if (!roomClient) return;
            me.audioOnly
              ? roomClient.disableAudioOnly()
              : roomClient.enableAudioOnly();
          }}
        />
      </div>
      <div className="info">
        <p className="text">
          <span className="label">server:&nbsp;&nbsp;</span>
          {room.mediasoupVersion || "unknown"}
        </p>
        <p className="text">
          <span className="label">client:&nbsp;&nbsp;</span>
          {mediasoupClientVersion || "unknown"}
        </p>
        <p className="text">
          <span className="label">handler:&nbsp;&nbsp;</span>
          {room.mediasoupClientHandler || "unknown"}
        </p>
      </div>

      <div className="room-link-wrapper">
        <div className="room-link">
          <a
            className="link"
            href={room.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              // If this is a 'Open in new window/tab' don't prevent click default action
              if (
                event.ctrlKey ||
                event.shiftKey ||
                event.metaKey ||
                (event.button && event.button === 1)
              ) {
                return;
              }

              event.preventDefault();
              handleRoomLinkCopy();
            }}
          >
            invitation link
          </a>
        </div>
      </div>

      <Peers />

      <div
        className={`me-container ${amActiveSpeaker ? "active-speaker" : ""}`}
      >
        <Me />
      </div>

      <div className="chat-input-container">
        <ChatInput />
      </div>

      <div className="sidebar">
        <div
          className={`button hide-videos ${me.audioOnly ? "on" : ""} ${
            me.audioOnlyInProgress ? "disabled" : ""
          }`}
          data-tip="Show/hide participants' video"
          onClick={() => {
            if (!roomClient) return;
            me.audioOnly
              ? roomClient.disableAudioOnly()
              : roomClient.enableAudioOnly();
          }}
        />

        <div
          className={`button mute-audio ${me.audioMuted ? "on" : ""}`}
          data-tip="Mute/unmute participants' audio"
          onClick={() => {
            if (!roomClient) return;
            me.audioMuted ? roomClient.unmuteAudio() : roomClient.muteAudio();
          }}
        />

        <div
          className={`button restart-ice ${
            me.restartIceInProgress ? "disabled" : ""
          }`}
          data-tip="Restart ICE"
          onClick={() => {
            if (!roomClient) return;
            roomClient.restartIce();
          }}
        />
      </div>

      <Stats />
    </div>
  );
};

export default Room;
