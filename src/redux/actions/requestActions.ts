// src/redux/actions/requestActions.ts
import { createAsyncThunk } from "@reduxjs/toolkit";
import { Notification, RootState } from "@/types";
import {
  addNotification,
  removeNotification,
} from "@/redux/actions/notificationActions";
import Logger from "@/services/Logger";

const logger = new Logger("RequestActions");

// Notification thunk
export const notify = createAsyncThunk(
  "notifications/notify",
  async (notification: Omit<Notification, "id">, { dispatch }) => {
    const id = Date.now().toString();
    const fullNotification: Notification = {
      id,
      ...notification,
    };

    logger.debug("Creating notification:", fullNotification);

    dispatch(addNotification(fullNotification));

    // Auto-remove notifications after timeout
    if (notification.timeout) {
      setTimeout(() => {
        dispatch(removeNotification(id));
      }, notification.timeout);
    }

    return fullNotification;
  }
);

// Request consumer key frame
export const requestConsumerKeyFrame = createAsyncThunk(
  "consumer/requestKeyFrame",
  async ({ consumerId }: { consumerId: string }, { getState }) => {
    const state = getState() as RootState;
    const { roomClient } = window as any;

    if (!roomClient) {
      throw new Error("RoomClient not available");
    }

    try {
      await roomClient.requestConsumerKeyFrame(consumerId);
      logger.debug("Key frame requested for consumer:", consumerId);
    } catch (error) {
      logger.error("Failed to request key frame:", error);
      throw error;
    }
  }
);

// For backward compatibility
export const requestActions = {
  notify,
};
