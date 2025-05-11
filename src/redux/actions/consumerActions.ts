// src/redux/actions/consumerActions.ts
import { createAction } from "@reduxjs/toolkit";
import { ConsumerActionType, Consumer } from "@/types";

export const addConsumer = createAction<Consumer>(
  ConsumerActionType.ADD_CONSUMER
);

export const removeConsumer = createAction<{
  consumerId: string;
  peerId: string;
}>(ConsumerActionType.REMOVE_CONSUMER);

export const setConsumerPaused = createAction<{
  consumerId: string;
  origin: "local" | "remote";
}>(ConsumerActionType.SET_CONSUMER_PAUSED);

export const setConsumerResumed = createAction<{
  consumerId: string;
  origin: "local" | "remote";
}>(ConsumerActionType.SET_CONSUMER_RESUMED);

export const setConsumerPreferredLayers = createAction<{
  consumerId: string;
  spatialLayer: number;
  temporalLayer: number;
}>(ConsumerActionType.SET_CONSUMER_PREFERRED_LAYERS);

export const setConsumerCurrentLayers = createAction<{
  consumerId: string;
  spatialLayer: number | null;
  temporalLayer: number | null;
}>(ConsumerActionType.SET_CONSUMER_CURRENT_LAYERS);

export const setConsumerScore = createAction<{
  consumerId: string;
  score: any;
}>(ConsumerActionType.SET_CONSUMER_SCORE);

export const setConsumerPriority = createAction<{
  consumerId: string;
  priority: number;
}>(ConsumerActionType.SET_CONSUMER_PRIORITY);
