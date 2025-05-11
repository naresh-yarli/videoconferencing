// src/types/protoo-client.d.ts
// Type definitions for protoo-client

declare module "protoo-client" {
  import { EventEmitter } from "events";

  export class Peer extends EventEmitter {
    constructor(transport: Transport);
    readonly id: string;
    readonly closed: boolean;
    data: any;

    close(): void;
    request(method: string, data?: any): Promise<any>;
    notify(method: string, data?: any): void;

    on(event: "open", listener: () => void): this;
    on(event: "failed", listener: (currentAttempt: number) => void): this;
    on(event: "disconnected", listener: () => void): this;
    on(event: "close", listener: () => void): this;
    on(
      event: "request",
      listener: (request: any, accept: Function, reject: Function) => void
    ): this;
    on(event: "notification", listener: (notification: any) => void): this;
  }

  export class WebSocketTransport {
    constructor(url: string, options?: any);
    close(): void;
  }

  export type Transport = WebSocketTransport;
}
