// src/utils/urlValidator.ts
/**
 * URL parameter validation utilities
 * Provides validation functions for each parameter type
 */
import { URLParams } from "@/types/urls/urlParams";
import Logger from "@/services/Logger";

const logger = new Logger("URLValidator");

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates room ID format
 * @param roomId - Room ID to validate
 */
export function validateRoomId(roomId?: string): ValidationError | null {
  if (!roomId) return null; // Optional parameter

  // Room ID should be alphanumeric with optional hyphens/underscores
  const regex = /^[a-zA-Z0-9\-_]+$/;
  if (!regex.test(roomId)) {
    return {
      field: "roomId",
      message:
        "Room ID must be alphanumeric with optional hyphens or underscores",
    };
  }

  if (roomId.length > 50) {
    return {
      field: "roomId",
      message: "Room ID must be 50 characters or less",
    };
  }

  return null;
}

/**
 * Validates display name
 * @param displayName - Display name to validate
 */
export function validateDisplayName(
  displayName?: string
): ValidationError | null {
  if (!displayName) return null; // Optional parameter

  if (displayName.length > 50) {
    return {
      field: "displayName",
      message: "Display name must be 50 characters or less",
    };
  }

  // Prevent XSS
  if (/<[^>]*>/g.test(displayName)) {
    return {
      field: "displayName",
      message: "Display name cannot contain HTML tags",
    };
  }

  return null;
}

/**
 * Validates all URL parameters
 * @param params - Parameters to validate
 */
export function validateURLParams(params: URLParams): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate individual fields
  const roomIdError = validateRoomId(params.roomId);
  if (roomIdError) errors.push(roomIdError);

  const displayNameError = validateDisplayName(params.displayName);
  if (displayNameError) errors.push(displayNameError);

  // Validate codec conflicts
  const codecFlags = [
    params.forceVP8,
    params.forceH264,
    params.forceVP9,
    params.forceAV1,
  ];
  const activeCodecs = codecFlags.filter(Boolean).length;

  if (activeCodecs > 1) {
    errors.push({
      field: "codec",
      message: "Only one codec can be forced at a time",
    });
  }

  // Validate scalability modes
  if (
    params.webcamScalabilityMode &&
    !validateScalabilityMode(params.webcamScalabilityMode)
  ) {
    errors.push({
      field: "webcamScalabilityMode",
      message: "Invalid webcam scalability mode format",
    });
  }

  if (
    params.sharingScalabilityMode &&
    !validateScalabilityMode(params.sharingScalabilityMode)
  ) {
    errors.push({
      field: "sharingScalabilityMode",
      message: "Invalid sharing scalability mode format",
    });
  }

  // Validate numeric ranges
  if (params.numSimulcastStreams !== undefined) {
    if (params.numSimulcastStreams < 1 || params.numSimulcastStreams > 3) {
      errors.push({
        field: "numSimulcastStreams",
        message: "Number of simulcast streams must be between 1 and 3",
      });
    }
  }

  if (errors.length > 0) {
    logger.warn("URL parameter validation errors", { errors });
  }

  return errors;
}

/**
 * Validates scalability mode format
 * @param mode - Scalability mode string
 */
function validateScalabilityMode(mode: string): boolean {
  const regex = /^L[1-3]T[1-3](_KEY)?$/;
  return regex.test(mode);
}

/**
 * Sanitizes URL parameters to prevent XSS
 * @param params - Parameters to sanitize
 */
export function sanitizeURLParams(params: URLParams): URLParams {
  const sanitized: URLParams = { ...params };

  // Sanitize string parameters
  if (sanitized.roomId) {
    sanitized.roomId = sanitized.roomId.replace(/[^a-zA-Z0-9\-_]/g, "");
  }

  if (sanitized.displayName) {
    sanitized.displayName = sanitized.displayName.replace(/<[^>]*>/g, "");
  }

  if (sanitized.throttleSecret) {
    sanitized.throttleSecret = sanitized.throttleSecret.replace(
      /[^a-zA-Z0-9\-_]/g,
      ""
    );
  }

  if (sanitized.e2eKey) {
    sanitized.e2eKey = sanitized.e2eKey.replace(/[^a-zA-Z0-9\-_]/g, "");
  }

  return sanitized;
}
