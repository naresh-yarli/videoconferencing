// src/redux/actions/notificationActions.ts
import { createAction } from "@reduxjs/toolkit";
import { NotificationActionType, Notification } from "@/types";

export const addNotification = createAction<Notification>(
  NotificationActionType.ADD_NOTIFICATION
);

export const removeNotification = createAction<string>(
  NotificationActionType.REMOVE_NOTIFICATION
);

export const removeAllNotifications = createAction(
  NotificationActionType.REMOVE_ALL_NOTIFICATIONS
);
