// components/Notifications.tsx
import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../redux/store";
import { notificationsActions } from "../redux/store";
import { Notification } from "../types";

const Notifications: React.FC = () => {
  const notifications = useSelector((state: RootState) => state.notifications);
  const dispatch = useDispatch();

  const handleNotificationClick = (notificationId: string) => {
    dispatch(notificationsActions.removeNotification(notificationId));
  };

  return (
    <div className="Notifications">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification ${notification.type}`}
          onClick={() => handleNotificationClick(notification.id)}
        >
          <div className="icon" />

          <div className="body">
            {notification.title && (
              <p className="title">{notification.title}</p>
            )}
            <p className="text">{notification.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Notifications;
