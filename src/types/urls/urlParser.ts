// src/utils/urlParser.ts
/**
 * URL parameter parser utility
 * Extracts and validates query parameters from URL
 */
import { URLParams, URL_PARAM_DEFAULTS } from "@/types/urls/urlParams";
import Logger from "@/services/Logger";

const logger = new Logger("URLParser");

/**
 * Parses boolean string values
 * @param value - String value to parse
 * @param defaultValue - Default value if parsing fails
 */
function parseBoolean(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  return value.toLowerCase() === "true";
}

/**
 * Parses integer string values
 * @param value - String value to parse
 * @param defaultValue - Default value if parsing fails
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 */
function parseInteger(
  value: string | null,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (value === null) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;

  if (min !== undefined && parsed < min) return defaultValue;
  if (max !== undefined && parsed > max) return defaultValue;

  return parsed;
}

/**
 * Validates codec parameter
 * @param codec - Codec string to validate
 */
function validateCodec(codec: string): boolean {
  const validCodecs = ["vp8", "h264", "vp9", "av1"];
  return validCodecs.includes(codec.toLowerCase());
}

/**
 * Validates scalability mode
 * @param mode - Scalability mode string
 */
function validateScalabilityMode(mode: string): boolean {
  // Valid modes: L1T1, L1T2, L1T3, L2T1, L2T2, L2T3, L3T1, L3T2, L3T3, L3T3_KEY
  const regex = /^L[1-3]T[1-3](_KEY)?$/;
  return regex.test(mode);
}

/**
 * Parses URL parameters and returns validated configuration
 * @param url - URL string or URL object to parse
 */
export function parseURLParams(url: string | URL): URLParams {
  logger.debug("Parsing URL parameters", { url: url.toString() });

  const urlObj = typeof url === "string" ? new URL(url) : url;
  const params = new URLSearchParams(urlObj.search);

  const result: URLParams = {};

  // String parameters
  result.roomId = params.get("roomId") || URL_PARAM_DEFAULTS.roomId;
  result.displayName =
    params.get("displayName") || URL_PARAM_DEFAULTS.displayName;
  result.handlerName =
    params.get("handlerName") ||
    params.get("handler") ||
    URL_PARAM_DEFAULTS.handlerName;
  result.throttleSecret =
    params.get("throttleSecret") || URL_PARAM_DEFAULTS.throttleSecret;
  result.e2eKey = params.get("e2eKey") || URL_PARAM_DEFAULTS.e2eKey;
  result.consumerReplicas =
    params.get("consumerReplicas") || URL_PARAM_DEFAULTS.consumerReplicas;

  // Boolean parameters
  result.forceTcp = parseBoolean(
    params.get("forceTcp"),
    URL_PARAM_DEFAULTS.forceTcp
  );
  result.produce = parseBoolean(
    params.get("produce"),
    URL_PARAM_DEFAULTS.produce
  );
  result.consume = parseBoolean(
    params.get("consume"),
    URL_PARAM_DEFAULTS.consume
  );
  result.datachannel = parseBoolean(
    params.get("datachannel"),
    URL_PARAM_DEFAULTS.datachannel
  );
  result.forceVP8 = parseBoolean(
    params.get("forceVP8"),
    URL_PARAM_DEFAULTS.forceVP8
  );
  result.forceH264 = parseBoolean(
    params.get("forceH264"),
    URL_PARAM_DEFAULTS.forceH264
  );
  result.forceVP9 = parseBoolean(
    params.get("forceVP9"),
    URL_PARAM_DEFAULTS.forceVP9
  );
  result.forceAV1 = parseBoolean(
    params.get("forceAV1"),
    URL_PARAM_DEFAULTS.forceAV1
  );
  result.enableWebcamLayers = parseBoolean(
    params.get("enableWebcamLayers"),
    URL_PARAM_DEFAULTS.enableWebcamLayers
  );
  result.enableSharingLayers = parseBoolean(
    params.get("enableSharingLayers"),
    URL_PARAM_DEFAULTS.enableSharingLayers
  );
  result.info = parseBoolean(params.get("info"), URL_PARAM_DEFAULTS.info);
  result.faceDetection = parseBoolean(
    params.get("faceDetection"),
    URL_PARAM_DEFAULTS.faceDetection
  );
  result.externalVideo = parseBoolean(
    params.get("externalVideo"),
    URL_PARAM_DEFAULTS.externalVideo
  );

  // Integer parameters
  result.numSimulcastStreams = parseInteger(
    params.get("numSimulcastStreams"),
    URL_PARAM_DEFAULTS.numSimulcastStreams,
    1, // min
    3 // max
  );

  // Scalability mode parameters
  const webcamMode = params.get("webcamScalabilityMode");
  const sharingMode = params.get("sharingScalabilityMode");

  if (webcamMode && validateScalabilityMode(webcamMode)) {
    result.webcamScalabilityMode = webcamMode;
  }

  if (sharingMode && validateScalabilityMode(sharingMode)) {
    result.sharingScalabilityMode = sharingMode;
  }

  // Validate codec conflicts
  const codecFlags = [
    result.forceVP8,
    result.forceH264,
    result.forceVP9,
    result.forceAV1,
  ];
  const activeCodecs = codecFlags.filter(Boolean).length;

  if (activeCodecs > 1) {
    logger.warn("Multiple codec flags specified, using first one found");
    // Keep only the first active codec
    if (result.forceVP8) {
      result.forceH264 = false;
      result.forceVP9 = false;
      result.forceAV1 = false;
    } else if (result.forceH264) {
      result.forceVP9 = false;
      result.forceAV1 = false;
    } else if (result.forceVP9) {
      result.forceAV1 = false;
    }
  }

  logger.debug("Parsed URL parameters", result);
  return result;
}

/**
 * Updates URL with parameters without page reload
 * @param params - Parameters to update in URL
 */
export function updateURLParams(params: Partial<URLParams>): void {
  const url = new URL(window.location.href);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      url.searchParams.delete(key);
    } else if (typeof value === "boolean") {
      url.searchParams.set(key, value.toString());
    } else {
      url.searchParams.set(key, value.toString());
    }
  });

  window.history.replaceState({}, "", url.toString());
  logger.debug("Updated URL parameters", { url: url.toString() });
}

/**
 * Gets current URL parameters
 */
export function getCurrentURLParams(): URLParams {
  return parseURLParams(window.location.href);
}

/**
 * Merges URL parameters with defaults
 * @param params - Partial parameters to merge
 */
export function mergeWithDefaults(
  params: Partial<URLParams>
): Required<URLParams> {
  return { ...URL_PARAM_DEFAULTS, ...params };
}
