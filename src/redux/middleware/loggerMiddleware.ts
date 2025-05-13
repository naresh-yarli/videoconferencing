// src/redux/middleware/loggerMiddleware.ts
import { Middleware, AnyAction } from "@reduxjs/toolkit";
import { RootState } from "@/types";
import Logger from "@/services/Logger";

const logger = new Logger("ReduxLogger");

export const loggerMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action: unknown) => {
    // Disable all logging
    return next(action);
  };

function calculateStateDiff(prevState: RootState, nextState: RootState): any {
  return {};
}
