// src/redux/store.ts
import { configureStore } from "@reduxjs/toolkit";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  RoomState,
  Me,
  Peer,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
  Notification,
} from "@/types";

import {
  initializeAppState,
  loadPersistedState,
} from "@/utils/stateInitializer";
import { persistenceMiddleware } from "@/redux/middleware/persistenceMiddleware";
import { errorMiddleware } from "@/redux/middleware/errorMiddleware";
import { loggerMiddleware } from "@/redux/middleware/loggerMiddleware";
// Define the initial state
interface AppState {
  room: RoomState;
  me: Me;
  peers: Record<string, Peer>;
  producers: Record<string, Producer>;
  consumers: Record<string, Consumer>;
  dataProducers: Record<string, DataProducer>;
  dataConsumers: Record<string, DataConsumer>;
  notifications: Notification[];
}

const initialState: AppState = {
  room: {
    roomId: "",
    state: "new",
    activeSpeakerId: undefined,
    url: undefined,
    faceDetection: false,
    mediasoupVersion: undefined,
    mediasoupClientVersion: undefined,
    mediasoupClientHandler: undefined,
    statsPeerId: null, // Added this missing field
  },
  me: {
    id: "",
    displayName: "",
    displayNameSet: false,
    device: {
      flag: "unknown",
    },
    canSendMic: false,
    canSendWebcam: false,
    canChangeWebcam: false,
    webcamInProgress: false,
    audioOnly: false,
    audioOnlyInProgress: false,
    restartIceInProgress: false,
    audioMuted: false,
    videoMuted: false,
    shareInProgress: false,
  },
  peers: {},
  producers: {},
  consumers: {},
  dataProducers: {},
  dataConsumers: {},
  notifications: [],
};

// Create room slice
const roomSlice = createSlice({
  name: "room",
  initialState: initialState.room,
  reducers: {
    setRoomState: (
      state,
      action: PayloadAction<"new" | "connecting" | "connected" | "closed">
    ) => {
      state.state = action.payload;
    },
    setRoomActiveSpeaker: (
      state,
      action: PayloadAction<string | undefined>
    ) => {
      state.activeSpeakerId = action.payload;
    },
    setRoomUrl: (state, action: PayloadAction<string>) => {
      state.url = action.payload;
    },
    setRoomFaceDetection: (state, action: PayloadAction<boolean>) => {
      state.faceDetection = action.payload;
    },
    setRoomMediasoupInfo: (
      state,
      action: PayloadAction<{
        mediasoupVersion?: string;
        mediasoupClientVersion?: string;
        mediasoupClientHandler?: string;
      }>
    ) => {
      if (action.payload.mediasoupVersion) {
        state.mediasoupVersion = action.payload.mediasoupVersion;
      }
      if (action.payload.mediasoupClientVersion) {
        state.mediasoupClientVersion = action.payload.mediasoupClientVersion;
      }
      if (action.payload.mediasoupClientHandler) {
        state.mediasoupClientHandler = action.payload.mediasoupClientHandler;
      }
    },
    setRoomStatsPeerId: (state, action: PayloadAction<string | null>) => {
      state.statsPeerId = action.payload;
    },
  },
});

// Create me slice
const meSlice = createSlice({
  name: "me",
  initialState: initialState.me,
  reducers: {
    setMe: (state, action: PayloadAction<Partial<Me>>) => {
      return { ...state, ...action.payload };
    },
    setDisplayName: (
      state,
      action: PayloadAction<{ displayName: string; displayNameSet: boolean }>
    ) => {
      state.displayName = action.payload.displayName;
      state.displayNameSet = action.payload.displayNameSet;
    },
    setMediaCapabilities: (
      state,
      action: PayloadAction<{
        canSendMic?: boolean;
        canSendWebcam?: boolean;
        canChangeWebcam?: boolean;
      }>
    ) => {
      if (action.payload.canSendMic !== undefined) {
        state.canSendMic = action.payload.canSendMic;
      }
      if (action.payload.canSendWebcam !== undefined) {
        state.canSendWebcam = action.payload.canSendWebcam;
      }
      if (action.payload.canChangeWebcam !== undefined) {
        state.canChangeWebcam = action.payload.canChangeWebcam;
      }
    },
    setWebcamInProgress: (state, action: PayloadAction<boolean>) => {
      state.webcamInProgress = action.payload;
    },
    setAudioOnly: (state, action: PayloadAction<boolean>) => {
      state.audioOnly = action.payload;
    },
    setAudioOnlyInProgress: (state, action: PayloadAction<boolean>) => {
      state.audioOnlyInProgress = action.payload;
    },
    setRestartIceInProgress: (state, action: PayloadAction<boolean>) => {
      state.restartIceInProgress = action.payload;
    },
    setAudioMuted: (state, action: PayloadAction<boolean>) => {
      state.audioMuted = action.payload;
    },
    setVideoMuted: (state, action: PayloadAction<boolean>) => {
      state.videoMuted = action.payload;
    },
  },
});

// Create peers slice
const peersSlice = createSlice({
  name: "peers",
  initialState: initialState.peers,
  reducers: {
    addPeer: (state, action: PayloadAction<Peer>) => {
      state[action.payload.id] = action.payload;
    },
    removePeer: (state, action: PayloadAction<string>) => {
      delete state[action.payload];
    },
    setPeerDisplayName: (
      state,
      action: PayloadAction<{ peerId: string; displayName: string }>
    ) => {
      if (state[action.payload.peerId]) {
        state[action.payload.peerId].displayName = action.payload.displayName;
      }
    },
    addConsumerToPeer: (
      state,
      action: PayloadAction<{ peerId: string; consumerId: string }>
    ) => {
      if (state[action.payload.peerId]) {
        if (
          !state[action.payload.peerId].consumers.includes(
            action.payload.consumerId
          )
        ) {
          state[action.payload.peerId].consumers.push(
            action.payload.consumerId
          );
        }
      }
    },
    removeConsumerFromPeer: (
      state,
      action: PayloadAction<{ peerId: string; consumerId: string }>
    ) => {
      if (state[action.payload.peerId]) {
        state[action.payload.peerId].consumers = state[
          action.payload.peerId
        ].consumers.filter((id) => id !== action.payload.consumerId);
      }
    },
    addDataConsumerToPeer: (
      state,
      action: PayloadAction<{ peerId: string; dataConsumerId: string }>
    ) => {
      if (state[action.payload.peerId]) {
        if (
          !state[action.payload.peerId].dataConsumers.includes(
            action.payload.dataConsumerId
          )
        ) {
          state[action.payload.peerId].dataConsumers.push(
            action.payload.dataConsumerId
          );
        }
      }
    },
    removeDataConsumerFromPeer: (
      state,
      action: PayloadAction<{ peerId: string; dataConsumerId: string }>
    ) => {
      if (state[action.payload.peerId]) {
        state[action.payload.peerId].dataConsumers = state[
          action.payload.peerId
        ].dataConsumers.filter((id) => id !== action.payload.dataConsumerId);
      }
    },
  },
});

// Create producers slice
const producersSlice = createSlice({
  name: "producers",
  initialState: initialState.producers,
  reducers: {
    addProducer: (state, action: PayloadAction<Producer>) => {
      return {
        ...state,
        [action.payload.id]: action.payload,
      };
    },
    removeProducer: (
      state,
      action: PayloadAction<{ id: string } | { kind: "audio" | "video" }>
    ) => {
      if ("id" in action.payload) {
        const newState = { ...state };
        delete newState[action.payload.id];
        return newState;
      } else {
        const kindToRemove = action.payload.kind;
        const idToRemove = Object.keys(state).find((id) => {
          const producer = state[id];
          return (
            producer && producer.track && producer.track.kind === kindToRemove
          );
        });

        if (idToRemove) {
          const newState = { ...state };
          delete newState[idToRemove];
          return newState;
        }
        return state; // No change if producer not found by kind
      }
    },
    setProducerPaused: (
      state,
      action: PayloadAction<
        | { id: string; paused: boolean }
        | { kind: "audio" | "video"; paused: boolean }
      >
    ) => {
      let producerIdToUpdate: string | undefined;
      let pausedState: boolean | undefined;

      if ("id" in action.payload) {
        if (state[action.payload.id]) {
          producerIdToUpdate = action.payload.id;
          pausedState = action.payload.paused;
        }
      } else {
        const kindToModify = action.payload.kind;
        producerIdToUpdate = Object.keys(state).find((id) => {
          const producer = state[id];
          return (
            producer && producer.track && producer.track.kind === kindToModify
          );
        });
        if (producerIdToUpdate) {
          pausedState = action.payload.paused;
        }
      }

      if (
        producerIdToUpdate &&
        pausedState !== undefined &&
        state[producerIdToUpdate]
      ) {
        return {
          ...state,
          [producerIdToUpdate]: {
            ...state[producerIdToUpdate],
            paused: pausedState,
          },
        };
      }
      return state; // No change if producer not found or pausedState is undefined
    },
    setProducerScore: (
      state,
      action: PayloadAction<{ id: string; score: any }>
    ) => {
      if (state[action.payload.id]) {
        return {
          ...state,
          [action.payload.id]: {
            ...state[action.payload.id],
            score: action.payload.score,
          },
        };
      }
      return state; // No change if producer not found
    },
  },
});

// Create consumers slice
const consumersSlice = createSlice({
  name: "consumers",
  initialState: initialState.consumers,
  reducers: {
    addConsumer: (state, action: PayloadAction<Consumer>) => {
      state[action.payload.id] = action.payload;
    },
    removeConsumer: (state, action: PayloadAction<string>) => {
      delete state[action.payload];
    },
    setConsumerPaused: (
      state,
      action: PayloadAction<{
        id: string;
        locallyPaused?: boolean;
        remotelyPaused?: boolean;
      }>
    ) => {
      if (state[action.payload.id]) {
        if (action.payload.locallyPaused !== undefined) {
          state[action.payload.id].locallyPaused = action.payload.locallyPaused;
        }
        if (action.payload.remotelyPaused !== undefined) {
          state[action.payload.id].remotelyPaused =
            action.payload.remotelyPaused;
        }
      }
    },
    setConsumerCurrentLayers: (
      state,
      action: PayloadAction<{
        id: string;
        spatialLayer?: number | null;
        temporalLayer?: number | null;
      }>
    ) => {
      if (state[action.payload.id]) {
        if (action.payload.spatialLayer !== undefined) {
          state[action.payload.id].currentSpatialLayer =
            action.payload.spatialLayer;
        }
        if (action.payload.temporalLayer !== undefined) {
          state[action.payload.id].currentTemporalLayer =
            action.payload.temporalLayer;
        }
      }
    },
    setConsumerPreferredLayers: (
      state,
      action: PayloadAction<{
        id: string;
        spatialLayer: number;
        temporalLayer: number;
      }>
    ) => {
      if (state[action.payload.id]) {
        state[action.payload.id].preferredSpatialLayer =
          action.payload.spatialLayer;
        state[action.payload.id].preferredTemporalLayer =
          action.payload.temporalLayer;
      }
    },
    setConsumerPriority: (
      state,
      action: PayloadAction<{ id: string; priority: number }>
    ) => {
      if (state[action.payload.id]) {
        state[action.payload.id].priority = action.payload.priority;
      }
    },
    setConsumerScore: (
      state,
      action: PayloadAction<{ id: string; score: any }>
    ) => {
      if (state[action.payload.id]) {
        state[action.payload.id].score = action.payload.score;
      }
    },
  },
});

// Create data producers slice
const dataProducersSlice = createSlice({
  name: "dataProducers",
  initialState: initialState.dataProducers,
  reducers: {
    addDataProducer: (state, action: PayloadAction<DataProducer>) => {
      state[action.payload.id] = action.payload;
    },
    removeDataProducer: (state, action: PayloadAction<string>) => {
      delete state[action.payload];
    },
  },
});

// Create data consumers slice
const dataConsumersSlice = createSlice({
  name: "dataConsumers",
  initialState: initialState.dataConsumers,
  reducers: {
    addDataConsumer: (state, action: PayloadAction<DataConsumer>) => {
      state[action.payload.id] = action.payload;
    },
    removeDataConsumer: (state, action: PayloadAction<string>) => {
      delete state[action.payload];
    },
  },
});

// Create notifications slice
const notificationsSlice = createSlice({
  name: "notifications",
  initialState: initialState.notifications,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.push(action.payload);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      return state.filter((notification) => notification.id !== action.payload);
    },
  },
});

// Export actions
export const roomActions = roomSlice.actions;
export const meActions = meSlice.actions;
export const peersActions = peersSlice.actions;
export const producersActions = producersSlice.actions;
export const consumersActions = consumersSlice.actions;
export const dataProducersActions = dataProducersSlice.actions;
export const dataConsumersActions = dataConsumersSlice.actions;
export const notificationsActions = notificationsSlice.actions;

// Initialize state from URL, cookies, and localStorage
const { room: initialRoomState, me: initialMeState } = initializeAppState();
const persistedState = loadPersistedState();

// Merge initial and persisted states
const preloadedState = {
  ...persistedState,
  room: { ...initialRoomState, ...persistedState.room },
  me: { ...initialMeState, ...persistedState.me },
  peers: {},
  producers: {},
  consumers: {},
  dataProducers: {},
  dataConsumers: {},
  notifications: [],
};
// Create store
export const store = configureStore({
  reducer: {
    room: roomSlice.reducer,
    me: meSlice.reducer,
    peers: peersSlice.reducer,
    producers: producersSlice.reducer,
    consumers: consumersSlice.reducer,
    dataProducers: dataProducersSlice.reducer,
    dataConsumers: dataConsumersSlice.reducer,
    notifications: notificationsSlice.reducer,
  },
  preloadedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in actions
        ignoredActionPaths: ["payload.track", "payload.rtpParameters"],
        // Ignore non-serializable values in the state
        ignoredPaths: [
          "producers",
          "consumers",
          "dataProducers",
          "dataConsumers",
        ],
      },
    })
      .concat(errorMiddleware)
      .concat(loggerMiddleware)
      .concat(persistenceMiddleware),
  devTools: process.env.NODE_ENV !== "production" && {
    name: "Video Conference Demo",
    trace: true,
    traceLimit: 25,
    features: {
      pause: true,
      lock: true,
      persist: true,
      export: true,
      import: "custom",
      jump: true,
      skip: true,
      reorder: true,
      dispatch: true,
      test: true,
    },
  },
});

// // Create store with all enhancements
// export const store = configureStore({
//   reducer: {
//     room: roomSlice.reducer,
//     me: meSlice.reducer,
//     peers: peersSlice.reducer,
//     producers: producersSlice.reducer,
//     consumers: consumersSlice.reducer,
//     dataProducers: dataProducersSlice.reducer,
//     dataConsumers: dataConsumersSlice.reducer,
//     notifications: notificationsSlice.reducer,
//   },
//   preloadedState,
//   middleware: (getDefaultMiddleware) =>
//     getDefaultMiddleware({
//       serializableCheck: {
//         ignoredActionPaths: ['payload.track', 'payload.rtpParameters'],
//         ignoredPaths: [
//           'producers',
//           'consumers',
//           'dataProducers',
//           'dataConsumers',
//         ],
//       },
//       thunk: {
//         extraArgument: {
//           // Add any extra arguments for thunks here
//           // e.g., roomClient instance
//         },
//       },
//     })
//     .concat(errorMiddleware)
//     .concat(loggerMiddleware)
//     .concat(persistenceMiddleware),
//   devTools: process.env.NODE_ENV !== 'production' && {
//     name: 'MediaSoup Demo',
//     trace: true,
//     traceLimit: 25,
//     actionsDenylist: ['@@INIT'],
//     stateSanitizer: (state) => ({
//       ...state,
//       // Sanitize MediaStreamTrack objects for DevTools
//       producers: '<<MEDIA_TRACKS>>',
//       consumers: '<<MEDIA_TRACKS>>',
//     }),
//   },
// });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export all actions
export * from "./actions";

// Create request actions
export const requestActions = {
  // Notifications
  notify: (notification: Omit<Notification, "id">) => {
    return (dispatch: AppDispatch) => {
      const id = String(Date.now());
      const finalNotification: Notification = {
        id,
        ...notification,
      };

      dispatch(notificationsActions.addNotification(finalNotification));

      // Auto-remove notifications after timeout if specified
      if (notification.timeout) {
        setTimeout(() => {
          dispatch(notificationsActions.removeNotification(id));
        }, notification.timeout);
      }
    };
  },
};
