// src/redux/actions/peerActions.ts
import { createAction } from "@reduxjs/toolkit";
import { PeerActionType, Peer } from "@/types";

export const addPeer = createAction<{
  peer: Peer;
  consumers: any[];
  dataConsumers: any[];
}>(PeerActionType.ADD_PEER);

export const removePeer = createAction<string>(PeerActionType.REMOVE_PEER);

export const setPeerDisplayName = createAction<{
  displayName: string;
  peerId: string;
}>(PeerActionType.SET_PEER_DISPLAY_NAME);
