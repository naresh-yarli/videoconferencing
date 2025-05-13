// src/types/index.ts
// Complete types file with all necessary interfaces and type definitions

// Redux Action Types
export enum RoomActionType {
  SET_ROOM_STATE = "SET_ROOM_STATE",
  SET_ROOM_ACTIVE_SPEAKER = "SET_ROOM_ACTIVE_SPEAKER",
  SET_ROOM_STATS_PEER_ID = "SET_ROOM_STATS_PEER_ID",
  SET_ROOM_FACE_DETECTION = "SET_ROOM_FACE_DETECTION",
  SET_ROOM_URL = "SET_ROOM_URL",
  SET_MEDIASOUP_VERSION = "SET_MEDIASOUP_VERSION",
  SET_MEDIASOUP_CLIENT_VERSION = "SET_MEDIASOUP_CLIENT_VERSION",
  SET_MEDIASOUP_CLIENT_HANDLER = "SET_MEDIASOUP_CLIENT_HANDLER",
}

export enum MeActionType {
  SET_ME = "SET_ME",
  SET_MEDIA_CAPABILITIES = "SET_MEDIA_CAPABILITIES",
  SET_CAN_CHANGE_WEBCAM = "SET_CAN_CHANGE_WEBCAM",
  SET_DISPLAY_NAME = "SET_DISPLAY_NAME",
  SET_WEBCAM_IN_PROGRESS = "SET_WEBCAM_IN_PROGRESS",
  SET_SHARE_IN_PROGRESS = "SET_SHARE_IN_PROGRESS",
  SET_AUDIO_ONLY = "SET_AUDIO_ONLY",
  SET_AUDIO_ONLY_IN_PROGRESS = "SET_AUDIO_ONLY_IN_PROGRESS",
  SET_RESTART_ICE_IN_PROGRESS = "SET_RESTART_ICE_IN_PROGRESS",
  SET_AUDIO_MUTED = "SET_AUDIO_MUTED",
  SET_AUDIO_MUTED_STATE = "SET_AUDIO_MUTED_STATE",
  SET_VIDEO_MUTED = "SET_VIDEO_MUTED",
  SET_VIDEO_MUTED_STATE = "SET_VIDEO_MUTED_STATE",
}

export enum PeerActionType {
  ADD_PEER = "ADD_PEER",
  REMOVE_PEER = "REMOVE_PEER",
  SET_PEER_DISPLAY_NAME = "SET_PEER_DISPLAY_NAME",
}

export enum ProducerActionType {
  ADD_PRODUCER = "ADD_PRODUCER",
  REMOVE_PRODUCER = "REMOVE_PRODUCER",
  SET_PRODUCER_PAUSED = "SET_PRODUCER_PAUSED",
  SET_PRODUCER_RESUMED = "SET_PRODUCER_RESUMED",
  SET_PRODUCER_TRACK = "SET_PRODUCER_TRACK",
  SET_PRODUCER_SCORE = "SET_PRODUCER_SCORE",
}

export enum ConsumerActionType {
  ADD_CONSUMER = "ADD_CONSUMER",
  REMOVE_CONSUMER = "REMOVE_CONSUMER",
  SET_CONSUMER_PAUSED = "SET_CONSUMER_PAUSED",
  SET_CONSUMER_RESUMED = "SET_CONSUMER_RESUMED",
  SET_CONSUMER_PREFERRED_LAYERS = "SET_CONSUMER_PREFERRED_LAYERS",
  SET_CONSUMER_CURRENT_LAYERS = "SET_CONSUMER_CURRENT_LAYERS",
  SET_CONSUMER_SCORE = "SET_CONSUMER_SCORE",
  SET_CONSUMER_PRIORITY = "SET_CONSUMER_PRIORITY",
}

export enum DataProducerActionType {
  ADD_DATA_PRODUCER = "ADD_DATA_PRODUCER",
  REMOVE_DATA_PRODUCER = "REMOVE_DATA_PRODUCER",
}

export enum DataConsumerActionType {
  ADD_DATA_CONSUMER = "ADD_DATA_CONSUMER",
  REMOVE_DATA_CONSUMER = "REMOVE_DATA_CONSUMER",
}

export enum NotificationActionType {
  ADD_NOTIFICATION = "ADD_NOTIFICATION",
  REMOVE_NOTIFICATION = "REMOVE_NOTIFICATION",
  REMOVE_ALL_NOTIFICATIONS = "REMOVE_ALL_NOTIFICATIONS",
}

// Room state interface
export interface RoomState {
  state: "new" | "connecting" | "connected" | "disconnected" | "closed";
  roomId: string;
  url?: string;
  faceDetection: boolean;
  activeSpeakerId?: string;
  statsPeerId: string | null;
  mediasoupVersion?: string;
  mediasoupClientVersion?: string;
  mediasoupClientHandler?: string;
}

// Device information interface
export interface Device {
  flag: string;
  name?: string;
  version?: string;
  os?: string;
}

// Local user (Me) interface
export interface Me {
  id: string;
  displayName?: string;
  displayNameSet: boolean;
  device: Device;
  canSendMic: boolean;
  canSendWebcam: boolean;
  canChangeWebcam: boolean;
  webcamInProgress: boolean;
  shareInProgress: boolean;
  audioOnly: boolean;
  audioOnlyInProgress: boolean;
  restartIceInProgress: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
}

// Remote peer interface
export interface Peer {
  id: string;
  displayName?: string;
  device: Device;
  consumers: string[];
  dataConsumers: string[];
}

// Media producer interface
export interface Producer {
  id: string;
  deviceLabel?: string;
  type?: "front" | "back" | "share";
  paused: boolean;
  track: MediaStreamTrack;
  rtpParameters: any;
  codec: string;
  score?: any;
}

// Media consumer interface
export interface Consumer {
  id: string;
  locallyPaused: boolean;
  remotelyPaused: boolean;
  track: MediaStreamTrack;
  type?: "simple" | "simulcast" | "svc" | "simulcast/svc";
  score?: any;
  codec?: string;
  rtpParameters: any;
  spatialLayers?: number;
  temporalLayers?: number;
  currentSpatialLayer?: number | null;
  currentTemporalLayer?: number | null;
  preferredSpatialLayer?: number;
  preferredTemporalLayer?: number;
  priority?: number;
}

// Data producer interface for chat and other data
export interface DataProducer {
  id: string;
  label?: string;
  protocol?: string;
  sctpStreamParameters: any;
}

// Data consumer interface for chat and other data
export interface DataConsumer {
  id: string;
  label?: string;
  protocol?: string;
  sctpStreamParameters: any;
}

// Notification interface
export interface Notification {
  id: string;
  type: "info" | "error" | "warning";
  text: string;
  title?: string;
  timeout?: number;
}

// Authentication configuration
export interface AuthConfig {
  apiUrl: string;
  authToken: string;
}

// Connection information obtained from the backend
export interface ConnectionInfo {
  webSocketUrl: string;
  authToken: string;
}

// URL query parameters interface
export interface URLParams {
  roomId?: string;
  displayName?: string;
  handler?: string;
  handlerName?: string;
  forceTcp?: string;
  produce?: string;
  consume?: string;
  datachannel?: string;
  forceVP8?: string;
  forceH264?: string;
  forceVP9?: string;
  forceAV1?: string;
  enableWebcamLayers?: string;
  enableSharingLayers?: string;
  webcamScalabilityMode?: string;
  sharingScalabilityMode?: string;
  numSimulcastStreams?: string;
  info?: string;
  faceDetection?: string;
  externalVideo?: string;
  throttleSecret?: string;
  e2eKey?: string;
  consumerReplicas?: string;
}

// RoomClient configuration interface
export interface RoomClientConfig {
  roomId: string;
  peerId: string;
  displayName: string;
  device: Device;
  handlerName?: string;
  forceTcp?: boolean;
  produce?: boolean;
  consume?: boolean;
  useDataChannel?: boolean;
  forceVP8?: boolean;
  forceH264?: boolean;
  forceVP9?: boolean;
  forceAV1?: boolean;
  enableWebcamLayers?: boolean;
  enableSharingLayers?: boolean;
  webcamScalabilityMode?: string;
  sharingScalabilityMode?: string;
  numSimulcastStreams?: number;
  externalVideo?: boolean;
  e2eKey?: string;
  consumerReplicas?: string;
  authConfig: AuthConfig;
  store?: any; // Redux store
}

// Transport statistics interface
export interface TransportStats {
  transportId: string;
  timestamp: number;
  bytesReceived?: number;
  bytesSent?: number;
  dtlsState?: string;
  iceConnectionState?: string;
  iceSelectedTuple?: any;
  probationBytesSent?: number;
  probationSendBitrate?: number;
  recvBitrate?: number;
  sendBitrate?: number;
  availableIncomingBitrate?: number;
  availableOutgoingBitrate?: number;
}

// WebRTC Peer Connection Constraints
export interface PeerConnectionOptions {
  constraints?: any;
  config?: RTCConfiguration;
  proprietaryConstraints?: any;
}

// Simulcast encoding configuration
export interface SimulcastEncoding {
  ssrc?: number;
  rid?: string;
  maxBitrate?: number;
  maxFramerate?: number;
  scalabilityMode?: string;
  scaleResolutionDownBy?: number;
  dtx?: boolean;
}

// Video constraints interface
export interface VideoConstraints {
  width?: { min?: number; ideal?: number; max?: number };
  height?: { min?: number; ideal?: number; max?: number };
  frameRate?: { min?: number; ideal?: number; max?: number };
  aspectRatio?: { min?: number; ideal?: number; max?: number };
  facingMode?: "user" | "environment" | { ideal: "user" | "environment" };
  deviceId?: { ideal: string } | string;
}

// Audio constraints interface
export interface AudioConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  deviceId?: { ideal: string } | string;
}

// Media constraints interface
export interface MediaConstraints {
  audio?: boolean | AudioConstraints;
  video?: boolean | VideoConstraints;
}

// Network throttle options interface
export interface NetworkThrottleOptions {
  secret: string;
  uplink?: number;
  downlink?: number;
  rtt?: number;
  packetLoss?: number;
  silent?: boolean;
}

// Root state type for Redux store
export interface RootState {
  room: RoomState;
  me: Me;
  peers: Record<string, Peer>;
  producers: Record<string, Producer>;
  consumers: Record<string, Consumer>;
  dataProducers: Record<string, DataProducer>;
  dataConsumers: Record<string, DataConsumer>;
  notifications: Notification[];
}

// Action creator return types
export interface Action<T = any> {
  type: string;
  payload?: T;
}

// Redux action creators interfaces
export interface RequestActions {
  notify: (notification: Omit<Notification, "id">) => any;
}

// Room event types for event emitters
export interface RoomEvents {
  joined: () => void;
  left: () => void;
  closed: () => void;
  connected: () => void;
  disconnected: () => void;
  notification: (notification: any) => void;
  joinFailed: (error: Error) => void;
  displayNameChanged: (displayName: string) => void;
  producer: (producer: Producer) => void;
  consumer: (consumer: Consumer) => void;
  dataProducer: (dataProducer: DataProducer) => void;
  dataConsumer: (dataConsumer: DataConsumer) => void;
  activeSpeaker: (peerId: string) => void;
  message: (message: any) => void;
  micProducer: (producer: Producer) => void;
  webcamProducer: (producer: Producer) => void;
  shareProducer: (producer: Producer) => void;
  micProducerClosed: () => void;
  webcamProducerClosed: () => void;
  shareProducerClosed: () => void;
  micPaused: () => void;
  micResumed: () => void;
  webcamChanged: (producer: Producer) => void;
  chatDataProducer: (dataProducer: DataProducer) => void;
  botDataProducer: (dataProducer: DataProducer) => void;
  audioOnlyEnabled: () => void;
  audioOnlyDisabled: () => void;
  audioMuted: () => void;
  audioUnmuted: () => void;
  iceRestarted: () => void;
  consumerPaused: (consumerId: string) => void;
  consumerResumed: (consumerId: string) => void;
  maxSendingSpatialLayerChanged: (spatialLayer: number) => void;
}

// E2E Encryption configuration
export interface E2EConfig {
  key: string;
  operation: "encode" | "decode" | "setCryptoKey";
  useCryptoOffset?: boolean;
}

// AppDispatch type for Redux actions (will be properly typed in store)
export type AppDispatch = any;
