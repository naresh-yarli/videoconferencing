// src/services/Logger.ts
export default class Logger {
  private readonly prefix: string;
  private static readonly DEBUG = false; // Disable all logging
  private static readonly LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: string, data?: any): any {
    const formattedMessage = `[${this.getTimestamp()}] [${level}] [${
      this.prefix
    }] ${message}`;

    if (data !== undefined) {
      return [formattedMessage, data];
    }

    return [formattedMessage];
  }

  debug(message: string, data?: any): void {
    // Disabled
  }

  info(message: string, data?: any): void {
    // Disabled
  }

  warn(message: string, data?: any): void {
    // Disabled
  }

  error(message: string, data?: any): void {
    // Disabled
  }

  // Method for WebRTC-specific logging
  webrtc(message: string, data?: any): void {
    // Disabled
  }

  // Method for Redux-specific logging
  redux(message: string, data?: any): void {
    // Disabled
  }

  // Group logging for better organization
  group(label: string): void {
    // Disabled
  }

  groupEnd(): void {
    // Disabled
  }

  // Table logging for structured data
  table(data: any[], columns?: string[]): void {
    // Disabled
  }

  // Performance logging
  time(label: string): void {
    // Disabled
  }

  timeEnd(label: string): void {
    // Disabled
  }

  // Assert for debugging
  assert(condition: boolean, message: string, data?: any): void {
    // Disabled
  }
}

// Optional: Global logger instance for general use
export const globalLogger = new Logger("App");
