// src/redux/actions/dataConsumerActions.ts
import { createAction } from "@reduxjs/toolkit";
import { DataConsumerActionType, DataConsumer } from "@/types";

export const addDataConsumer = createAction<{
  dataConsumer: DataConsumer;
  peerId?: string;
}>(DataConsumerActionType.ADD_DATA_CONSUMER);

export const removeDataConsumer = createAction<{
  dataConsumerId: string;
  peerId?: string;
}>(DataConsumerActionType.REMOVE_DATA_CONSUMER);
