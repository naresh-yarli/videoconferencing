// src/types/mediasoup-client.d.ts
// Type definitions for mediasoup-client

declare module "mediasoup-client" {
  export class Device {
    constructor();
    readonly loaded: boolean;
    readonly rtpCapabilities: any;
    readonly sctpCapabilities: any;
    readonly handlerName: string;

    load(options: { routerRtpCapabilities: any }): Promise<void>;
    canProduce(kind: "audio" | "video"): boolean;
    createSendTransport(options: any): Transport;
    createRecvTransport(options: any): Transport;
  }

  export class Transport extends EventEmitter {
    readonly id: string;
    readonly closed: boolean;
    readonly direction: "send" | "recv";
    readonly connectionState: string;
    readonly appData: any;

    close(): void;
    produce(options: any): Promise<Producer>;
    consume(options: any): Promise<Consumer>;
    produceData(options: any): Promise<DataProducer>;
    consumeData(options: any): Promise<DataConsumer>;
    getStats(): Promise<any>;
    restartIce(options: any): Promise<void>;
    updateIceServers(options: any): Promise<void>;

    on(
      event: "connect",
      listener: (options: any, callback: Function, errback: Function) => void
    ): this;
    on(event: "connectionstatechange", listener: (state: string) => void): this;
    on(
      event: "produce",
      listener: (options: any, callback: Function, errback: Function) => void
    ): this;
    on(
      event: "producedata",
      listener: (options: any, callback: Function, errback: Function) => void
    ): this;
  }

  export class Producer extends EventEmitter {
    readonly id: string;
    readonly closed: boolean;
    readonly kind: "audio" | "video";
    readonly rtpSender: RTCRtpSender;
    readonly track: MediaStreamTrack;
    readonly rtpParameters: any;
    readonly paused: boolean;
    readonly score: any;
    readonly appData: any;

    close(): void;
    getStats(): Promise<any>;
    pause(): void;
    resume(): void;
    replaceTrack(options: { track: MediaStreamTrack }): Promise<void>;
    setMaxSpatialLayer(spatialLayer: number): Promise<void>;
    setRtpEncodingParameters(parameters: any): Promise<void>;

    on(event: "transportclose", listener: () => void): this;
    on(event: "trackended", listener: () => void): this;
    on(event: "close", listener: () => void): this;
  }

  export class Consumer extends EventEmitter {
    readonly id: string;
    readonly closed: boolean;
    readonly kind: "audio" | "video";
    readonly rtpReceiver: RTCRtpReceiver;
    readonly track: MediaStreamTrack;
    readonly rtpParameters: any;
    readonly paused: boolean;
    readonly score: any;
    readonly appData: any;
    readonly type: string;

    close(): void;
    getStats(): Promise<any>;
    pause(): void;
    resume(): void;

    on(event: "transportclose", listener: () => void): this;
    on(event: "trackended", listener: () => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "pause", listener: () => void): this;
    on(event: "resume", listener: () => void): this;
  }

  export class DataProducer extends EventEmitter {
    readonly id: string;
    readonly closed: boolean;
    readonly sctpStreamParameters: any;
    readonly label: string;
    readonly protocol: string;
    readonly bufferedAmount: number;
    readonly bufferedAmountLowThreshold: number;
    readonly readyState: string;
    readonly appData: any;

    close(): void;
    send(data: string | ArrayBuffer | ArrayBufferView): void;
    getStats(): Promise<any>;

    on(event: "transportclose", listener: () => void): this;
    on(event: "open", listener: () => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (error: any) => void): this;
    on(event: "bufferedamountlow", listener: () => void): this;
  }

  export class DataConsumer extends EventEmitter {
    readonly id: string;
    readonly closed: boolean;
    readonly sctpStreamParameters: any;
    readonly label: string;
    readonly protocol: string;
    readonly appData: any;

    close(): void;
    getStats(): Promise<any>;

    on(event: "transportclose", listener: () => void): this;
    on(event: "open", listener: () => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (error: any) => void): this;
    on(
      event: "message",
      listener: (message: string | ArrayBuffer) => void
    ): this;
  }

  export function parseScalabilityMode(scalabilityMode: string): {
    spatialLayers: number;
    temporalLayers: number;
  };

  export const version: string;

  import { EventEmitter } from "events";
}
