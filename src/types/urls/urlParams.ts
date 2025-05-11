// src/types/urlParams.ts
/**
 * URL query parameters interface for room configuration
 * All parameters are optional and parsed from URL query string
 */
export interface URLParams {
  roomId?: string;
  displayName?: string;
  handlerName?: string;
  handler?: string; // Alias for handlerName
  forceTcp?: boolean;
  produce?: boolean;
  consume?: boolean;
  datachannel?: boolean;
  forceVP8?: boolean;
  forceH264?: boolean;
  forceVP9?: boolean;
  forceAV1?: boolean;
  enableWebcamLayers?: boolean;
  enableSharingLayers?: boolean;
  webcamScalabilityMode?: string;
  sharingScalabilityMode?: string;
  numSimulcastStreams?: number;
  info?: boolean;
  faceDetection?: boolean;
  externalVideo?: boolean;
  throttleSecret?: string;
  e2eKey?: string;
  consumerReplicas?: string;
}

/**
 * Default values for URL parameters
 */
export const URL_PARAM_DEFAULTS: Required<URLParams> = {
  roomId: "",
  displayName: "",
  handlerName: "",
  handler: "",
  forceTcp: false,
  produce: true,
  consume: true,
  datachannel: true,
  forceVP8: false,
  forceH264: false,
  forceVP9: false,
  forceAV1: false,
  enableWebcamLayers: true,
  enableSharingLayers: true,
  webcamScalabilityMode: "",
  sharingScalabilityMode: "",
  numSimulcastStreams: 3,
  info: false,
  faceDetection: false,
  externalVideo: false,
  throttleSecret: "",
  e2eKey: "",
  consumerReplicas: "",
};
