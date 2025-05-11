// components/Peers.tsx
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { Peer as PeerType } from "../types";
import Peer from "./Peer";

const Peers: React.FC = () => {
  const peers = useSelector((state: RootState) => {
    const peersArray = Object.values(state.peers);
    return peersArray;
  });

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
