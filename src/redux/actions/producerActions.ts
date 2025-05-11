// src/redux/actions/producerActions.ts
import { createAction } from "@reduxjs/toolkit";
import { ProducerActionType, Producer } from "@/types";

export const addProducer = createAction<Producer>(
  ProducerActionType.ADD_PRODUCER
);

export const removeProducer = createAction<{
  id?: string;
  kind?: "audio" | "video";
}>(ProducerActionType.REMOVE_PRODUCER);

export const setProducerPaused = createAction<{
  id?: string;
  kind?: "audio" | "video";
  paused: boolean;
}>(ProducerActionType.SET_PRODUCER_PAUSED);

export const setProducerResumed = createAction<{
  id?: string;
  kind?: "audio" | "video";
}>(ProducerActionType.SET_PRODUCER_RESUMED);

export const setProducerTrack = createAction<{
  id: string;
  track: MediaStreamTrack;
}>(ProducerActionType.SET_PRODUCER_TRACK);

export const setProducerScore = createAction<{
  id: string;
  score: any;
}>(ProducerActionType.SET_PRODUCER_SCORE);
