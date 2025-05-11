// src/services/Logger.ts
export default class Logger {
  private readonly prefix: string;
  private static readonly DEBUG = process.env.NODE_ENV === "development";
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
    if (!Logger.DEBUG) return;

    const args = this.formatMessage("DEBUG", message, data);
    console.log(...args);
  }

  info(message: string, data?: any): void {
    const args = this.formatMessage("INFO", message, data);
    console.info(...args);
  }

  warn(message: string, data?: any): void {
    const args = this.formatMessage("WARN", message, data);
    console.warn(...args);
  }

  error(message: string, data?: any): void {
    const args = this.formatMessage("ERROR", message, data);
    console.error(...args);
  }

  // Method for WebRTC-specific logging
  webrtc(message: string, data?: any): void {
    if (!Logger.DEBUG) return;

    const args = this.formatMessage("WEBRTC", message, data);
    console.log(...args);
  }

  // Method for Redux-specific logging
  redux(message: string, data?: any): void {
    if (!Logger.DEBUG) return;

    const args = this.formatMessage("REDUX", message, data);
    console.log(...args);
  }

  // Group logging for better organization
  group(label: string): void {
    if (!Logger.DEBUG) return;
    console.group(`[${this.prefix}] ${label}`);
  }

  groupEnd(): void {
    if (!Logger.DEBUG) return;
    console.groupEnd();
  }

  // Table logging for structured data
  table(data: any[], columns?: string[]): void {
    if (!Logger.DEBUG) return;

    if (columns) {
      console.table(data, columns);
    } else {
      console.table(data);
    }
  }

  // Performance logging
  time(label: string): void {
    if (!Logger.DEBUG) return;
    console.time(`[${this.prefix}] ${label}`);
  }

  timeEnd(label: string): void {
    if (!Logger.DEBUG) return;
    console.timeEnd(`[${this.prefix}] ${label}`);
  }

  // Assert for debugging
  assert(condition: boolean, message: string, data?: any): void {
    if (!Logger.DEBUG) return;

    if (!condition) {
      const args = this.formatMessage("ASSERT", message, data);
      console.assert(condition, ...args);
    }
  }
}

// Optional: Global logger instance for general use
export const globalLogger = new Logger("App");
