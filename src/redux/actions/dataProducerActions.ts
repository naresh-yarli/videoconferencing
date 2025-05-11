// src/redux/actions/dataProducerActions.ts
import { createAction } from "@reduxjs/toolkit";
import { DataProducerActionType, DataProducer } from "@/types";

export const addDataProducer = createAction<DataProducer>(
  DataProducerActionType.ADD_DATA_PRODUCER
);

export const removeDataProducer = createAction<string>(
  DataProducerActionType.REMOVE_DATA_PRODUCER
);
