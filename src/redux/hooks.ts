// src/redux/hooks.ts
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Custom hooks for common state selections
export const useRoom = () => useAppSelector((state) => state.room);
export const useMe = () => useAppSelector((state) => state.me);
export const usePeers = () => useAppSelector((state) => state.peers);
export const useProducers = () => useAppSelector((state) => state.producers);
export const useConsumers = () => useAppSelector((state) => state.consumers);
export const useNotifications = () =>
  useAppSelector((state) => state.notifications);

// Selectors with type guards
export const useProducerByKind = (kind: "audio" | "video") => {
  return useAppSelector((state) => {
    const producers = Object.values(state.producers);
    return producers.find((producer) => producer.track.kind === kind);
  });
};

export const useConsumersByPeer = (peerId: string) => {
  return useAppSelector((state) => {
    const peer = state.peers[peerId];
    if (!peer) return [];

    return peer.consumers
      .map((consumerId) => state.consumers[consumerId])
      .filter(Boolean);
  });
};
