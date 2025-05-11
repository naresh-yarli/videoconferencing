// src/redux/middleware/loggerMiddleware.ts
import { Middleware, AnyAction } from "@reduxjs/toolkit";
import { RootState } from "@/types";
import Logger from "@/services/Logger";

const logger = new Logger("ReduxLogger");

export const loggerMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action: unknown) => {
    if (process.env.NODE_ENV === "development") {
      const typedAction = action as AnyAction;
      logger.debug("Action dispatched:", {
        type: typedAction.type,
        payload: typedAction.payload,
      });

      const prevState = store.getState();
      const result = next(action);
      const nextState = store.getState();

      logger.debug("State change:", {
        action: typedAction.type,
        prevState,
        nextState,
        diff: calculateStateDiff(prevState, nextState),
      });

      return result;
    }

    return next(action);
  };

function calculateStateDiff(prevState: RootState, nextState: RootState): any {
  const diff: any = {};

  Object.keys(nextState).forEach((key) => {
    if (
      prevState[key as keyof RootState] !== nextState[key as keyof RootState]
    ) {
      diff[key] = {
        prev: prevState[key as keyof RootState],
        next: nextState[key as keyof RootState],
      };
    }
  });

  return diff;
}
