// components/Peers.tsx
import React from "react";
import { useSelector } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../redux/store";
import { Peer as PeerType } from "../types";
import Peer from "./Peer";

// Define a memoized selector for peers
const selectPeers = (state: RootState) => state.peers;

const selectPeersArray = createSelector(
  [selectPeers], // Input selectors
  (peersMap) => Object.values(peersMap) // Result function: only recomputes if peersMap changes
);

const Peers: React.FC = () => {
  // Use the memoized selector
  const peers = useSelector(selectPeersArray);

  const activeSpeakerId = useSelector(
    (state: RootState) => state.room.activeSpeakerId
  );

  return (
    <div className="Peers">
      {peers.map((peer) => (
        <div
          key={peer.id}
          className={`peer-container ${
            peer.id === activeSpeakerId ? "active-speaker" : ""
          }`}
        >
          <Peer id={peer.id} />
        </div>
      ))}
    </div>
  );
};

export default Peers;
