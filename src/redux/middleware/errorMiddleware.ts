// src/redux/middleware/errorMiddleware.ts
import { Middleware, AnyAction } from "@reduxjs/toolkit";
import { RootState } from "@/types";
import Logger from "@/services/Logger";

const logger = new Logger("ErrorMiddleware");

export const errorMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action: unknown) => {
    try {
      return next(action);
    } catch (error) {
      const typedAction = action as AnyAction;
      logger.error("Redux action error:", {
        action: typedAction.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Dispatch error notification
      store.dispatch({
        type: "ADD_NOTIFICATION",
        payload: {
          id: Date.now().toString(),
          type: "error",
          text: `Action failed: ${typedAction.type}`,
          timeout: 5000,
        },
      });

      // Re-throw to not swallow the error
      throw error;
    }
  };
