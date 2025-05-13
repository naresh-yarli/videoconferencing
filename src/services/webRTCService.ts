// services/WebRTCService.ts
import { Device, version as mediasoupClientVersion } from "mediasoup-client";
import { Peer, WebSocketTransport } from "protoo-client";
import { v4 as uuidv4 } from "uuid";
import {
  AuthConfig,
  ConnectionInfo,
  Consumer,
  Producer,
  DataProducer,
  DataConsumer,
} from "@/types";
import { EnhancedEventEmitter } from "./EnhancedEventEmitter";
import Logger from "./Logger";

// ICE Server Configuration Types
interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface IceServersConfig {
  iceServers: IceServer[];
}

// Fallback ICE servers (public STUN servers)
const FALLBACK_ICE_SERVERS: IceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
    ],
  },
];

// Validate ICE server configuration
function validateIceServers(iceServers: IceServer[]): boolean {
  if (!Array.isArray(iceServers)) return false;

  return iceServers.every((server) => {
    if (!server.urls) return false;
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.every(
      (url) =>
        typeof url === "string" &&
        (url.startsWith("stun:") ||
          url.startsWith("turn:") ||
          url.startsWith("turns:"))
    );
  });
}

interface RtpCodecCapability {
  mimeType: string;
  kind: string;
  clockRate: number;
  channels?: number;
  parameters?: any;
  rtcpFeedback?: any[];
}

const DEBUG = process.env.NODE_ENV !== "production";

type TransportConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "failed"
  | "closed"
  | "disconnected";

export class WebRTCService extends EnhancedEventEmitter {
  private readonly apiUrl: string;
  private readonly authToken: string;

  private streamId: string | null = null;
  private peerId: string | null = null;
  private isConnected = false;
  private isInitialized = false;

  // Mediasoup and Protoo objects
  private device: Device | null = null;
  private protooWebSocket: WebSocketTransport | null = null;
  private protooPeer: Peer | null = null;
  private sendTransport: any = null;
  private recvTransport: any = null;
  private producers = new Map<string, any>();
  private consumers = new Map<string, any>();
  private dataProducers = new Map<string, any>();
  private dataConsumers = new Map<string, any>();

  // Connection state
  private currentConnectionAttemptId: string | null = null;

  // Callbacks
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onProducerCallback: ((producer: Producer) => void) | null = null;
  private onConsumerCallback: ((consumer: Consumer) => void) | null = null;
  private onDataProducerCallback:
    | ((dataProducer: DataProducer) => void)
    | null = null;
  private onDataConsumerCallback:
    | ((dataConsumer: DataConsumer) => void)
    | null = null;
  private onNotificationCallback: ((notification: any) => void) | null = null;

  private logger: Logger;
  private producerIdPromises = new Map<string, (id: string) => void>();

  constructor(config: AuthConfig) {
    super();
    this.logger = new Logger("WebRTCService");
    this.apiUrl = config.apiUrl;
    this.authToken = config.authToken;

    this.log("debug", "WebRTCService constructor called");

    // Bind methods
    this.handleProtooOpen = this.handleProtooOpen.bind(this);
    this.handleProtooClose = this.handleProtooClose.bind(this);
    this.handleProtooFail = this.handleProtooFail.bind(this);
    this.handleProtooRequest = this.handleProtooRequest.bind(this);
    this.handleProtooNotification = this.handleProtooNotification.bind(this);
  }

  // Logger
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: any
  ): void {
    if (!DEBUG && level === "debug") return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      peerId: this.peerId,
      streamId: this.streamId,
      data,
    };

    const logString = `[WebRTCService] ${message}`;

    switch (level) {
      case "error":
        console.error(logString, data);
        break;
      case "warn":
        console.warn(logString, data);
        break;
      case "debug":
        console.debug(logString, data);
        break;
      default:
        console.log(logString, data);
    }
  }

  // Event registration methods
  public onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  public onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  public onProducer(callback: (producer: Producer) => void): void {
    this.onProducerCallback = callback;
  }

  public onConsumer(callback: (consumer: Consumer) => void): void {
    this.onConsumerCallback = callback;
  }

  public onDataProducer(callback: (dataProducer: DataProducer) => void): void {
    this.onDataProducerCallback = callback;
  }

  public onDataConsumer(callback: (dataConsumer: DataConsumer) => void): void {
    this.onDataConsumerCallback = callback;
  }

  public onNotification(callback: (notification: any) => void): void {
    this.onNotificationCallback = callback;
  }

  // Public API methods
  public async connect(
    roomId: string,
    displayName: string,
    connectionType: "publisher" | "viewer" = "publisher"
  ): Promise<void> {
    this.log("info", "Connecting to room", { roomId, connectionType });

    if (this.isConnected || this.currentConnectionAttemptId) {
      this.log(
        "warn",
        "Connection attempt already in progress, ignoring new request"
      );
      return;
    }

    this.streamId = roomId;
    this.peerId = `${connectionType}-${uuidv4()}`;

    const attemptId = uuidv4();
    this.currentConnectionAttemptId = attemptId;

    try {
      const { webSocketUrl, authToken } = await this.getConnectionInfo(
        connectionType
      );

      await this.connectProtoo(webSocketUrl, authToken, connectionType);

      if (this.currentConnectionAttemptId !== attemptId) {
        this.log("warn", `Aborting stale connection attempt ${attemptId}`);
        return;
      }

      this.device = new Device();

      const routerRtpCapabilities = await this.protooRequest(
        "getRouterRtpCapabilities"
      );
      await this.device.load({ routerRtpCapabilities });

      this.log("info", "Mediasoup device loaded", {
        canProduceAudio: this.device.canProduce("audio"),
        canProduceVideo: this.device.canProduce("video"),
      });

      await this.protooRequest("join", {
        displayName: displayName,
        device: {
          flag: this.detectBrowser(),
          name: navigator.userAgent,
          version: navigator.appVersion,
        },
        rtpCapabilities: this.device.rtpCapabilities,
        sctpCapabilities: this.device.sctpCapabilities,
      });

      // Create transports
      if (connectionType === "publisher" || connectionType === "viewer") {
        await this.createSendTransport();
      }

      if (connectionType === "viewer" || connectionType === "publisher") {
        await this.createRecvTransport();
      }

      this.isInitialized = true;
      this.log("info", "Connection setup complete");

      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    } catch (error) {
      this.log("error", "Failed to connect", {
        error: (error as Error).message,
      });
      await this.closeConnection();
      throw error;
    } finally {
      this.currentConnectionAttemptId = null;
    }
  }

  public async closeConnection(): Promise<void> {
    this.log("info", "Closing connection");

    this.isConnected = false;
    this.isInitialized = false;
    this.currentConnectionAttemptId = null;

    // Close all producers
    for (const producer of Array.from(this.producers.values())) {
      try {
        producer.close();
      } catch (e) {
        // Ignore errors
      }
    }
    this.producers.clear();

    // Close all consumers
    for (const consumer of Array.from(this.consumers.values())) {
      try {
        consumer.close();
      } catch (e) {
        // Ignore errors
      }
    }
    this.consumers.clear();

    // Close all data producers
    for (const dataProducer of Array.from(this.dataProducers.values())) {
      try {
        dataProducer.close();
      } catch (e) {
        // Ignore errors
      }
    }
    this.dataProducers.clear();

    // Close all data consumers
    for (const dataConsumer of Array.from(this.dataConsumers.values())) {
      try {
        dataConsumer.close();
      } catch (e) {
        // Ignore errors
      }
    }
    this.dataConsumers.clear();

    // Close transports
    if (this.sendTransport) {
      try {
        this.sendTransport.close();
      } catch (e) {
        // Ignore errors
      }
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      try {
        this.recvTransport.close();
      } catch (e) {
        // Ignore errors
      }
      this.recvTransport = null;
    }

    // Close protoo connection
    if (this.protooPeer) {
      try {
        this.protooPeer.close();
      } catch (e) {
        // Ignore errors
      }
      this.protooPeer = null;
    }

    if (this.protooWebSocket) {
      try {
        this.protooWebSocket.close();
      } catch (e) {
        // Ignore errors
      }
      this.protooWebSocket = null;
    }

    this.device = null;
    this.streamId = null;
    this.peerId = null;

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }

    this.log("info", "Connection closed and resources cleaned up");
  }

  // Media Producer Methods
  public async produceAudio(track: MediaStreamTrack): Promise<Producer | null> {
    if (!this.sendTransport || !this.device) {
      throw new Error("Send transport not created or device not loaded");
    }

    if (!this.device.canProduce("audio")) {
      throw new Error("Cannot produce audio - not supported by device");
    }

    this.log("info", "Creating audio producer");

    try {
      const tempId = uuidv4();
      let serverAssignedProducerId: string | undefined;

      const idPromise = new Promise<string>((resolve, reject) => {
        this.producerIdPromises.set(tempId, resolve);
        setTimeout(() => {
          if (this.producerIdPromises.has(tempId)) {
            this.producerIdPromises.delete(tempId);
            reject(
              new Error(
                `Timeout waiting for server-assigned ID for tempId: ${tempId}`
              )
            );
          }
        }, 10000);
      });

      const producer = await this.sendTransport.produce({
        track,
        codecOptions: {
          opusStereo: true,
          opusDtx: true,
          opusFec: true,
          opusNack: true,
        },
        appData: { source: "mic", tempId },
      });

      try {
        serverAssignedProducerId = await idPromise;
        this.log(
          "info",
          `Received server-assigned producer ID (audio): ${serverAssignedProducerId}`
        );
      } catch (idError) {
        this.log(
          "error",
          "Failed to get server-assigned producer ID (audio)",
          idError
        );
      }

      const finalProducerId = serverAssignedProducerId || producer.id;

      if (!finalProducerId) {
        this.log("error", "Failed to obtain a valid producer ID for audio.");
        if (this.producerIdPromises.has(tempId)) {
          this.producerIdPromises.delete(tempId);
        }
        throw new Error("Failed to obtain a valid producer ID for audio.");
      }

      this.log(
        "info",
        "Mediasoup-client audio Producer object after 'produce' and ID promise",
        {
          producerId: finalProducerId,
          originalProducerId: producer.id,
          appData: producer.appData,
          paused: producer.paused,
        }
      );

      this.producers.set("audio", producer);

      producer.on("transportclose", () => {
        this.log("info", "Audio producer transport closed");
        this.producers.delete("audio");
      });

      producer.on("trackended", () => {
        this.log("info", "Audio producer track ended");
        this.closeProducer("audio");
      });

      const producerInfo: Producer = {
        id: finalProducerId,
        deviceLabel: track.label,
        paused: producer.paused,
        track: producer.track,
        rtpParameters: producer.rtpParameters,
        codec: producer.rtpParameters.codecs[0].mimeType.split("/")[1],
      };

      if (this.onProducerCallback) {
        this.log(
          "info",
          "Calling onProducerCallback with producerInfo (audio)",
          { producerInfo }
        );
        this.onProducerCallback(producerInfo);
      }

      return producerInfo;
    } catch (error) {
      this.log("error", "Error creating audio producer", {
        error: (error as Error).message,
      });
      track.stop();
      return null;
    }
  }

  public async produceVideo(
    track: MediaStreamTrack,
    type: "front" | "back" | "share" = "front",
    preferredCodec?: any
  ): Promise<Producer | null> {
    if (!this.sendTransport || !this.device) {
      throw new Error("Send transport not created or device not loaded");
    }

    if (!this.device.canProduce("video")) {
      throw new Error("Cannot produce video - not supported by device");
    }

    this.log("info", "Creating video producer", { type });

    const encodings = this.getEncodings(type);
    const codecOptions = {
      videoGoogleStartBitrate: 1000,
    };

    this.log("debug", "Initial preferred video codec", preferredCodec);
    this.log(
      "debug",
      "Device RTP Capabilities Codecs",
      this.device?.rtpCapabilities?.codecs
    );

    let finalCodec = preferredCodec;

    if (
      encodings &&
      encodings.length > 1 &&
      finalCodec &&
      finalCodec.mimeType.toLowerCase() === "video/vp9"
    ) {
      this.log(
        "info",
        "Simulcast active with VP9 preferred. Checking for VP8/H264 fallback."
      );
      if (
        this.device &&
        this.device.rtpCapabilities &&
        this.device.rtpCapabilities.codecs
      ) {
        const vp8Codec = this.device.rtpCapabilities.codecs.find(
          (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/vp8"
        );
        if (vp8Codec) {
          this.log("info", "Using VP8 for simulcast instead of VP9.");
          finalCodec = vp8Codec;
        } else {
          this.log(
            "warn",
            "VP8 codec not found in device capabilities for simulcast fallback."
          );
          const h264Codec = this.device.rtpCapabilities.codecs.find(
            (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/h264"
          );
          if (h264Codec) {
            this.log("info", "Using H264 for simulcast instead of VP9/VP8.");
            finalCodec = h264Codec;
          } else {
            this.log(
              "warn",
              "VP8 and H264 not found for simulcast fallback, proceeding with preferred VP9. This might fail."
            );
          }
        }
      } else {
        this.log(
          "warn",
          "Device RTP capabilities or codecs not available for VP9 simulcast fallback. Proceeding with preferred VP9."
        );
      }
    }
    this.log("info", "Final video codec for produce()", finalCodec);

    try {
      const tempId = uuidv4();
      let serverAssignedProducerId: string | undefined;

      const idPromise = new Promise<string>((resolve, reject) => {
        this.producerIdPromises.set(tempId, resolve);
        setTimeout(() => {
          if (this.producerIdPromises.has(tempId)) {
            this.producerIdPromises.delete(tempId);
            reject(
              new Error(
                `Timeout waiting for server-assigned ID for tempId: ${tempId}`
              )
            );
          }
        }, 10000);
      });

      const producer = await this.sendTransport.produce({
        track,
        encodings: this.getEncodings(type),
        codecOptions,
        codec: finalCodec,
        appData: { source: type, tempId },
      });

      try {
        serverAssignedProducerId = await idPromise;
        this.log(
          "info",
          `Received server-assigned producer ID (video): ${serverAssignedProducerId}`
        );
      } catch (idError) {
        this.log(
          "error",
          "Failed to get server-assigned producer ID (video)",
          idError
        );
      }

      const finalProducerId = serverAssignedProducerId || producer.id;

      if (!finalProducerId) {
        this.log(
          "error",
          `Failed to obtain a valid producer ID for video (${type}).`
        );
        if (this.producerIdPromises.has(tempId)) {
          this.producerIdPromises.delete(tempId);
        }
        throw new Error(
          `Failed to obtain a valid producer ID for video (${type}).`
        );
      }

      this.log(
        "info",
        "Mediasoup-client video Producer object after 'produce' and ID promise",
        {
          producerId: finalProducerId,
          originalProducerId: producer.id,
          appData: producer.appData,
          type,
          paused: producer.paused,
        }
      );

      this.producers.set("video", producer);

      producer.on("transportclose", () => {
        this.log("info", "Video producer transport closed");
        this.producers.delete("video");
      });

      producer.on("trackended", () => {
        this.log("info", "Video producer track ended");
        this.closeProducer("video");
      });

      const producerInfo: Producer = {
        id: finalProducerId,
        deviceLabel: track.label,
        type,
        paused: producer.paused,
        track: producer.track,
        rtpParameters: producer.rtpParameters,
        codec: producer.rtpParameters.codecs[0].mimeType.split("/")[1],
      };

      if (this.onProducerCallback) {
        this.log(
          "info",
          "Calling onProducerCallback with producerInfo (video)",
          { producerInfo }
        );
        this.onProducerCallback(producerInfo);
      }

      return producerInfo;
    } catch (error) {
      this.log("error", "Error creating video producer", {
        error: (error as Error).message,
      });
      track.stop();
      return null;
    }
  }

  public closeProducer(kind: "audio" | "video"): void {
    const producer = this.producers.get(kind);

    if (!producer) {
      return;
    }

    this.log("info", `Closing ${kind} producer`);

    producer.close();
    this.producers.delete(kind);

    this.protooRequest("closeProducer", { producerId: producer.id }).catch(
      (error) => {
        this.log("error", `Error closing ${kind} producer`, {
          error: (error as Error).message,
        });
      }
    );
  }

  public async pauseProducer(kind: "audio" | "video"): Promise<void> {
    const producer = this.producers.get(kind);

    if (!producer) {
      return;
    }

    this.log("info", `Pausing ${kind} producer`);

    try {
      await this.protooRequest("pauseProducer", { producerId: producer.id });
      producer.pause();
    } catch (error) {
      this.log("error", `Error pausing ${kind} producer`, {
        error: (error as Error).message,
      });
    }
  }

  public async resumeProducer(kind: "audio" | "video"): Promise<void> {
    const producer = this.producers.get(kind);

    if (!producer) {
      return;
    }

    this.log("info", `Resuming ${kind} producer`);

    try {
      await this.protooRequest("resumeProducer", { producerId: producer.id });
      producer.resume();
    } catch (error) {
      this.log("error", `Error resuming ${kind} producer`, {
        error: (error as Error).message,
      });
    }
  }

  // Data Channel Methods
  public async createDataProducer(
    label: string,
    data?: any
  ): Promise<DataProducer | null> {
    if (!this.sendTransport || !this.device) {
      throw new Error("Send transport not created or device not loaded");
    }

    this.log("info", "Creating data producer", { label });

    try {
      const dataProducer = await this.sendTransport.produceData({
        ordered: true,
        label,
        protocol: "chatto",
        appData: { data },
      });

      this.dataProducers.set(label, dataProducer);

      dataProducer.on("transportclose", () => {
        this.log("info", `Data producer transport closed (${label})`);
        this.dataProducers.delete(label);
      });

      const dataProducerInfo: DataProducer = {
        id: dataProducer.id,
        label,
        sctpStreamParameters: dataProducer.sctpStreamParameters,
      };

      if (this.onDataProducerCallback) {
        this.onDataProducerCallback(dataProducerInfo);
      }

      return dataProducerInfo;
    } catch (error) {
      this.log("error", "Error creating data producer", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  public sendData(label: string, data: any): void {
    const dataProducer = this.dataProducers.get(label);

    if (!dataProducer) {
      this.log(
        "warn",
        `Cannot send data, no data producer found with label: ${label}`
      );
      return;
    }

    try {
      dataProducer.send(JSON.stringify(data));
    } catch (error) {
      this.log("error", "Error sending data", {
        error: (error as Error).message,
      });
    }
  }

  // Request stats for debugging
  public async getStats(): Promise<any> {
    const stats: any = {
      producers: {},
      consumers: {},
    };

    // Get producer stats
    for (const [kind, producer] of Array.from(this.producers.entries())) {
      try {
        const producerStats = await producer.getStats();
        stats.producers[kind] = producerStats;
      } catch (error) {
        this.log("error", `Error getting stats for ${kind} producer`, {
          error: (error as Error).message,
        });
      }
    }

    // Get consumer stats
    for (const [id, consumer] of Array.from(this.consumers.entries())) {
      try {
        const consumerStats = await consumer.getStats();
        stats.consumers[id] = consumerStats;
      } catch (error) {
        this.log("error", `Error getting stats for consumer ${id}`, {
          error: (error as Error).message,
        });
      }
    }

    return stats;
  }

  // Transport Management Methods
  public async restartIce(): Promise<void> {
    this.log("info", "Restarting ICE");

    try {
      if (this.sendTransport) {
        const iceParameters = await this.protooRequest("restartIce", {
          transportId: this.sendTransport.id,
        });
        await this.sendTransport.restartIce({ iceParameters });
      }

      if (this.recvTransport) {
        const iceParameters = await this.protooRequest("restartIce", {
          transportId: this.recvTransport.id,
        });
        await this.recvTransport.restartIce({ iceParameters });
      }
    } catch (error) {
      this.log("error", "Error restarting ICE", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Private Methods
  private async getConnectionInfo(
    connectionType: "publisher" | "viewer"
  ): Promise<ConnectionInfo> {
    if (!this.streamId) {
      this.log("error", "Stream ID not set before calling getConnectionInfo");
      throw new Error("Stream ID not set");
    }
    // Determine the target URL based on connection type
    const endpointPath =
      connectionType === "publisher"
        ? `/api/v1/webrtc/publish/${this.streamId}`
        : `/api/v1/webrtc/view/${this.streamId}`;

    const targetUrl = `${this.apiUrl}${endpointPath}`;

    const headers = {
      Authorization: `Bearer ${this.authToken}`,
      "Content-Type": "application/json",
    };

    // The body is empty for this initial handshake, as per the JS reference
    const body = JSON.stringify({});

    this.log(
      "info",
      `[WebRTCService] Getting connection info from: ${targetUrl} for room: ${this.streamId}, type: ${connectionType}`
    );

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.log(
        "error",
        `[WebRTCService] Failed to get connection info from backend: ${response.status}`,
        { errorBody }
      );
      throw new Error(
        `Failed to get connection info from backend: ${response.status} - ${errorBody}`
      );
    }

    const connectionData = await response.json();

    // Expect connectionData to match the ConnectionInfo interface:
    // { webSocketUrl: string, authToken: string }
    if (!connectionData.webSocketUrl || !connectionData.authToken) {
      this.log(
        "error",
        "[WebRTCService] Backend response for connection info is missing webSocketUrl or authToken",
        connectionData
      );
      throw new Error("Invalid connection info from backend");
    }

    return connectionData; // This should be { webSocketUrl: string, authToken: string }
  }

  private async connectProtoo(
    url: string,
    token: string,
    connectionType: "publisher" | "viewer"
  ): Promise<void> {
    this.log("debug", "Connecting Protoo WebSocket", { url });

    if (!this.peerId || !this.streamId) {
      throw new Error("peerId or streamId not set");
    }

    const protooUrl = `${url}?roomId=${this.streamId}&peerId=${this.peerId}&token=${token}&connectionType=${connectionType}`;

    const transport = new WebSocketTransport(protooUrl);
    this.protooWebSocket = transport;

    return new Promise<void>((resolve, reject) => {
      const peer = new Peer(transport);

      peer.on("open", () => {
        this.log("info", "Protoo connection opened");
        this.isConnected = true;
        this.protooPeer = peer;
        this.handleProtooOpen();
        resolve();
      });

      peer.on("failed", (error: any) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.log("error", "Protoo connection failed", { error: errorMessage });
        this.protooPeer = null;
        this.isConnected = false;
        this.handleProtooFail();
        reject(new Error(`Protoo connection failed: ${errorMessage}`));
      });

      peer.on("disconnected", () => {
        this.log("warn", "Protoo connection disconnected");
        if (this.isConnected) {
          this.isConnected = false;
          this.protooPeer = null;

          if (this.sendTransport) this.sendTransport.close();
          if (this.recvTransport) this.recvTransport.close();

          if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
          }
        }
      });

      peer.on("close", () => {
        this.log("info", "Protoo connection closed");
        if (this.isConnected) {
          this.isConnected = false;
          this.protooPeer = null;
          this.handleProtooClose();
        }
      });

      peer.on("request", this.handleProtooRequest);
      peer.on("notification", this.handleProtooNotification);
    });
  }

  private async protooRequest(method: string, data: any = {}): Promise<any> {
    if (!this.protooPeer || !this.isConnected) {
      throw new Error(
        `Protoo Peer not initialized or not connected for request: ${method}`
      );
    }

    this.log("debug", `Sending protoo request: ${method}`, { data });

    try {
      const result = await this.protooPeer.request(method, data);
      this.log("debug", `Received protoo response: ${method}`, { result });
      return result;
    } catch (error) {
      this.log("error", `Received protoo error response: ${method}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async createSendTransport(): Promise<void> {
    if (!this.device) {
      throw new Error("Device not loaded");
    }

    this.log("debug", "Creating send transport");

    try {
      const transportInfo = await this.protooRequest("createWebRtcTransport", {
        forceTcp: false,
        producing: true,
        consuming: false,
        sctpCapabilities: this.device.sctpCapabilities,
        // Explicitly request ICE server configuration
        requestIceServers: true,
      });

      // Validate and handle ICE servers
      if (
        !transportInfo.iceServers ||
        !validateIceServers(transportInfo.iceServers)
      ) {
        this.log(
          "warn",
          "Invalid or missing ICE servers in transport info, using fallback"
        );
        transportInfo.iceServers = FALLBACK_ICE_SERVERS;
      }

      this.sendTransport = this.device.createSendTransport(transportInfo);

      // Add ICE connection state handling
      this.handleIceConnectionStateChange(this.sendTransport, "send");

      this.sendTransport.on(
        "connect",
        async (
          { dtlsParameters }: { dtlsParameters: any },
          callback: () => void,
          errback: (error: Error) => void
        ) => {
          this.log("debug", "Send transport connect event");

          try {
            await this.protooRequest("connectWebRtcTransport", {
              transportId: this.sendTransport.id,
              dtlsParameters,
            });
            callback();
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      this.sendTransport.on(
        "produce",
        async (
          {
            kind,
            rtpParameters,
            appData,
          }: { kind: string; rtpParameters: any; appData: any },
          callback: (args: { id: string }) => void,
          errback: (error: any) => void
        ) => {
          this.log("debug", "Send transport produce event", { kind, appData });

          try {
            const { id: idFromServer } = await this.protooRequest("produce", {
              transportId: this.sendTransport.id,
              kind,
              rtpParameters,
              appData,
            });
            this.log(
              "info",
              `Protoo response for "produce" request [Kind: ${kind}] - Received ID:`,
              { idFromServer }
            );

            if (
              appData &&
              appData.tempId &&
              this.producerIdPromises.has(appData.tempId)
            ) {
              const resolve = this.producerIdPromises.get(appData.tempId);
              if (resolve) {
                resolve(idFromServer);
              }
              this.producerIdPromises.delete(appData.tempId);
            }

            callback({ id: idFromServer });
          } catch (error) {
            if (
              appData &&
              appData.tempId &&
              this.producerIdPromises.has(appData.tempId)
            ) {
              const rejectPromise = this.producerIdPromises.get(
                appData.tempId + "_reject"
              );
              if (rejectPromise) {
              }
              this.producerIdPromises.delete(appData.tempId);
              if (this.producerIdPromises.has(appData.tempId + "_reject")) {
                this.producerIdPromises.delete(appData.tempId + "_reject");
              }
            }
            this.log(
              "error",
              `Protoo request "produce" failed for kind ${kind}`,
              { error: (error as Error).message }
            );
            errback(error);
          }
        }
      );

      this.sendTransport.on(
        "producedata",
        async (
          {
            sctpStreamParameters,
            label,
            protocol,
            appData,
          }: {
            sctpStreamParameters: any;
            label: string;
            protocol: string;
            appData: any;
          },
          callback: (id: string) => void,
          errback: (error: any) => void
        ) => {
          this.log("debug", "Send transport producedata event", { label });

          try {
            const { id } = await this.protooRequest("produceData", {
              transportId: this.sendTransport.id,
              sctpStreamParameters,
              label,
              protocol,
              appData,
            });
            callback(id);
          } catch (error) {
            errback(error);
          }
        }
      );

      this.log("info", "Send transport created", { id: this.sendTransport.id });
    } catch (error) {
      this.log("error", "Failed to create send transport", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async createRecvTransport(): Promise<void> {
    if (!this.device) {
      throw new Error("Device not loaded");
    }

    this.log("debug", "Creating recv transport");

    try {
      const transportInfo = await this.protooRequest("createWebRtcTransport", {
        forceTcp: false,
        producing: false,
        consuming: true,
        sctpCapabilities: this.device.sctpCapabilities,
        // Explicitly request ICE server configuration
        requestIceServers: true,
      });

      // Validate and handle ICE servers
      if (
        !transportInfo.iceServers ||
        !validateIceServers(transportInfo.iceServers)
      ) {
        this.log(
          "warn",
          "Invalid or missing ICE servers in transport info, using fallback"
        );
        transportInfo.iceServers = FALLBACK_ICE_SERVERS;
      }

      this.recvTransport = this.device.createRecvTransport(transportInfo);

      // Add ICE connection state handling
      this.handleIceConnectionStateChange(this.recvTransport, "recv");

      this.recvTransport.on(
        "connect",
        async (
          { dtlsParameters }: { dtlsParameters: any },
          callback: () => void,
          errback: (error: Error) => void
        ) => {
          this.log("debug", "Recv transport connect event");

          try {
            await this.protooRequest("connectWebRtcTransport", {
              transportId: this.recvTransport.id,
              dtlsParameters,
            });
            callback();
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      this.recvTransport.on(
        "connectionstatechange",
        (state: TransportConnectionState) => {
          this.log("info", `Recv transport connection state: ${state}`);

          if (state === "failed" || state === "closed") {
            this.recvTransport.close();
            this.recvTransport = null;
          }
        }
      );

      this.log("info", "Recv transport created", { id: this.recvTransport.id });
    } catch (error) {
      this.log("error", "Failed to create recv transport", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async createConsumer(consumerInfo: any): Promise<Consumer | null> {
    if (!this.recvTransport || !this.device) {
      this.log(
        "error",
        "Cannot create consumer, recv transport or device not ready"
      );
      return null;
    }

    const { id, producerId, kind, rtpParameters, appData, producerPaused } =
      consumerInfo;

    this.log("debug", "Creating consumer", { id, kind });

    try {
      const consumer = await this.recvTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData: { ...appData },
      });

      this.consumers.set(consumer.id, consumer);

      consumer.on("transportclose", () => {
        this.log("info", `Consumer transport closed: ${consumer.id}`);
        this.consumers.delete(consumer.id);
      });

      consumer.on("trackended", () => {
        this.log("info", `Consumer track ended: ${consumer.id}`);
        this.closeConsumer(consumer.id);
      });

      // Build the consumer object to return
      const consumerData: Consumer = {
        id: consumer.id,
        locallyPaused: false,
        remotelyPaused: producerPaused,
        track: consumer.track,
        codec: consumer.rtpParameters.codecs[0].mimeType.split("/")[1],
        rtpParameters: consumer.rtpParameters,
      };

      // Add spatial/temporal layer info if available
      if (consumer.type !== "simple") {
        consumerData.spatialLayers = consumerInfo.spatialLayers;
        consumerData.temporalLayers = consumerInfo.temporalLayers;
        consumerData.currentSpatialLayer = null; // Will be updated later
        consumerData.currentTemporalLayer = null; // Will be updated later
        consumerData.preferredSpatialLayer = consumerInfo.spatialLayers - 1;
        consumerData.preferredTemporalLayer = consumerInfo.temporalLayers - 1;
      }

      if (this.onConsumerCallback) {
        this.onConsumerCallback(consumerData);
      }

      if (producerPaused) {
        this.pauseConsumer(consumer.id);
      }

      return consumerData;
    } catch (error) {
      this.log("error", "Error creating consumer", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  public async createDataConsumer(
    dataConsumerInfo: any
  ): Promise<DataConsumer | null> {
    if (!this.recvTransport || !this.device) {
      this.log(
        "error",
        "Cannot create data consumer, recv transport or device not ready"
      );
      return null;
    }

    const {
      id,
      dataProducerId,
      sctpStreamParameters,
      label,
      protocol,
      appData,
    } = dataConsumerInfo;

    this.log("debug", "Creating data consumer", { id, label });

    try {
      const dataConsumer = await this.recvTransport.consumeData({
        id,
        dataProducerId,
        sctpStreamParameters,
        label,
        protocol,
        appData: { ...appData },
      });

      this.dataConsumers.set(dataConsumer.id, dataConsumer);

      dataConsumer.on("transportclose", () => {
        this.log("info", `Data consumer transport closed: ${dataConsumer.id}`);
        this.dataConsumers.delete(dataConsumer.id);
      });

      dataConsumer.on("message", (message: string) => {
        let data;

        try {
          data = JSON.parse(message);
        } catch (error) {
          data = message;
        }

        this.log(
          "debug",
          `Data consumer message received: ${dataConsumer.id}`,
          { data }
        );

        // Emit notification with the data
        if (this.onNotificationCallback) {
          this.onNotificationCallback({
            type: "data",
            source: dataConsumer.label,
            data,
          });
        }
      });

      const dataConsumerData: DataConsumer = {
        id: dataConsumer.id,
        label: dataConsumer.label,
        sctpStreamParameters: dataConsumer.sctpStreamParameters,
      };

      if (this.onDataConsumerCallback) {
        this.onDataConsumerCallback(dataConsumerData);
      }

      return dataConsumerData;
    } catch (error) {
      this.log("error", "Error creating data consumer", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  public closeConsumer(consumerId: string): void {
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      return;
    }

    this.log("info", `Closing consumer: ${consumerId}`);

    consumer.close();
    this.consumers.delete(consumerId);
  }

  public async pauseConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      return;
    }

    this.log("info", `Pausing consumer: ${consumerId}`);

    try {
      await this.protooRequest("pauseConsumer", { consumerId });
      consumer.pause();
    } catch (error) {
      this.log("error", `Error pausing consumer: ${consumerId}`, {
        error: (error as Error).message,
      });
    }
  }

  public async resumeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      return;
    }

    this.log("info", `Resuming consumer: ${consumerId}`);

    try {
      await this.protooRequest("resumeConsumer", { consumerId });
      consumer.resume();
    } catch (error) {
      this.log("error", `Error resuming consumer: ${consumerId}`, {
        error: (error as Error).message,
      });
    }
  }

  public async setConsumerPreferredLayers(
    consumerId: string,
    spatialLayer: number,
    temporalLayer: number
  ): Promise<void> {
    this.log("info", `Setting consumer preferred layers: ${consumerId}`, {
      spatialLayer,
      temporalLayer,
    });

    try {
      await this.protooRequest("setConsumerPreferredLayers", {
        consumerId,
        spatialLayer,
        temporalLayer,
      });
    } catch (error) {
      this.log(
        "error",
        `Error setting consumer preferred layers: ${consumerId}`,
        { error: (error as Error).message }
      );
    }
  }

  public async setConsumerPriority(
    consumerId: string,
    priority: number
  ): Promise<void> {
    this.log("info", `Setting consumer priority: ${consumerId}`, { priority });

    try {
      await this.protooRequest("setConsumerPriority", {
        consumerId,
        priority,
      });
    } catch (error) {
      this.log("error", `Error setting consumer priority: ${consumerId}`, {
        error: (error as Error).message,
      });
    }
  }

  public async requestConsumerKeyFrame(consumerId: string): Promise<void> {
    this.log("info", `Requesting consumer key frame: ${consumerId}`);

    try {
      await this.protooRequest("requestConsumerKeyFrame", { consumerId });
    } catch (error) {
      this.log("error", `Error requesting consumer key frame: ${consumerId}`, {
        error: (error as Error).message,
      });
    }
  }

  // Handler methods for Protoo events
  private handleProtooOpen(): void {
    this.log("info", "Protoo connection opened");
  }

  private handleProtooFail(): void {
    this.log("error", "Protoo connection failed");
    this.closeConnection();
  }

  private handleProtooClose(): void {
    this.log("info", "Protoo connection closed");
  }

  private handleProtooRequest(
    request: any,
    accept: Function,
    reject: Function
  ): void {
    this.log("debug", `Received protoo request: ${request.method}`, {
      request,
    });

    switch (request.method) {
      case "newConsumer": {
        const consumerInfo = request.data;
        this.log("info", "New consumer request received", { consumerInfo });

        this.createConsumer(consumerInfo)
          .then(() => accept())
          .catch((error) => {
            this.log("error", "Error creating consumer from request", {
              error: (error as Error).message,
            });
            reject(error);
          });
        break;
      }

      case "newDataConsumer": {
        const dataConsumerInfo = request.data;
        this.log("info", "New data consumer request received", {
          dataConsumerInfo,
        });

        this.createDataConsumer(dataConsumerInfo)
          .then(() => accept())
          .catch((error) => {
            this.log("error", "Error creating data consumer from request", {
              error: (error as Error).message,
            });
            reject(error);
          });
        break;
      }

      default: {
        this.log("warn", `Unknown protoo request method: ${request.method}`);
        reject(new Error(`Unknown method: ${request.method}`));
      }
    }
  }

  private handleProtooNotification(notification: any): void {
    this.log("debug", `Received protoo notification: ${notification.method}`, {
      notification,
    });

    let specificNotificationData: any = notification; // Default to passing the whole notification

    switch (notification.method) {
      case "producerScore": {
        const { producerId, score } = notification.data;
        const producer = Array.from(this.producers.values()).find(
          (p) => p.id === producerId
        );

        if (producer) {
          producer.score = score;
        }
        // specificNotificationData remains the original notification to be passed through
        break;
      }
      case "mediasoup-version": {
        this.log(
          "info",
          "Received mediasoup-version notification (server)",
          notification.data
        );

        const serverVersion = notification.data.version;
        const clientVersion = mediasoupClientVersion; // Use imported mediasoup-client version
        const clientHandler = this.device?.handlerName || "unknown"; // Get handler name from device

        specificNotificationData = {
          type: "mediasoup-versions",
          payload: {
            version: serverVersion,
            clientVersion: clientVersion,
            clientHandler: clientHandler,
          },
        };
        break;
      }

      case "consumerScore": {
        const { consumerId, score } = notification.data;
        const consumer = this.consumers.get(consumerId);

        if (consumer) {
          consumer.score = score;
        }
        // specificNotificationData remains the original notification
        break;
      }

      case "consumerLayersChanged": {
        const { consumerId, spatialLayer, temporalLayer } = notification.data;
        const consumer = this.consumers.get(consumerId);

        if (consumer) {
          this.log("info", `Consumer layers changed: ${consumerId}`, {
            spatialLayer,
            temporalLayer,
          });
          consumer.currentSpatialLayer = spatialLayer;
          consumer.currentTemporalLayer = temporalLayer;
        }
        // specificNotificationData remains the original notification
        break;
      }

      case "consumerPaused": {
        const { consumerId } = notification.data;
        const consumer = this.consumers.get(consumerId);

        if (consumer) {
          this.log("info", `Consumer paused: ${consumerId}`);
          consumer.remotelyPaused = true;
        }
        // specificNotificationData remains the original notification
        break;
      }

      case "consumerResumed": {
        const { consumerId } = notification.data;
        const consumer = this.consumers.get(consumerId);

        if (consumer) {
          this.log("info", `Consumer resumed: ${consumerId}`);
          consumer.remotelyPaused = false;
        }
        // specificNotificationData remains the original notification
        break;
      }

      case "consumerClosed": {
        const { consumerId } = notification.data;
        const consumer = this.consumers.get(consumerId);

        if (consumer) {
          this.log("info", `Consumer closed: ${consumerId}`);
          consumer.close();
          this.consumers.delete(consumerId);
        }
        // specificNotificationData remains the original notification
        break;
      }

      case "dataConsumerClosed": {
        const { dataConsumerId } = notification.data;
        const dataConsumer = this.dataConsumers.get(dataConsumerId);

        if (dataConsumer) {
          this.log("info", `Data consumer closed: ${dataConsumerId}`);
          dataConsumer.close();
          this.dataConsumers.delete(dataConsumerId);
        }
        // specificNotificationData remains the original notification
        break;
      }

      case "activeSpeaker": {
        const { peerId } = notification.data;
        this.log("debug", `Active speaker: ${peerId}`);
        specificNotificationData = {
          // Transform for RoomClient
          type: "activeSpeaker",
          peerId: peerId,
        };
        break;
      }

      default: {
        this.log(
          "debug",
          `Unhandled notification method or passing through: ${notification.method}`
        );
        // specificNotificationData remains the original notification by default
      }
    }

    // Forward the processed/original notification to the RoomClient callback
    this.log(
      "debug",
      "[WebRTCService] Calling onNotificationCallback with:",
      specificNotificationData
    );
    if (this.onNotificationCallback) {
      this.onNotificationCallback(specificNotificationData);
    }
  }

  // Utility methods
  private detectBrowser(): string {
    const userAgent = window.navigator.userAgent.toLowerCase();

    if (userAgent.indexOf("chrome") > -1) {
      return "chrome";
    }
    if (userAgent.indexOf("firefox") > -1) {
      return "firefox";
    }
    if (userAgent.indexOf("safari") > -1) {
      return "safari";
    }
    if (userAgent.indexOf("edge") > -1) {
      return "edge";
    }

    return "unknown";
  }

  public getPreferredCodec(kind: "audio" | "video"): any {
    if (!this.device) {
      return null;
    }

    const codecs = this.device.rtpCapabilities.codecs || [];

    if (kind === "audio") {
      return codecs.find(
        (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "audio/opus"
      );
    }

    // Check if VP9 is supported
    const vp9Codec = codecs.find(
      (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/vp9"
    );
    if (vp9Codec) {
      return vp9Codec;
    }

    // Fallback to VP8
    const vp8Codec = codecs.find(
      (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/vp8"
    );
    if (vp8Codec) {
      return vp8Codec;
    }

    // Last resort: H264
    const h264Codec = codecs.find(
      (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/h264"
    );
    if (h264Codec) {
      return h264Codec;
    }

    return null;
  }

  private getEncodings(type: "front" | "back" | "share"): any[] {
    if (type === "share") {
      // For screen sharing
      return [
        {
          ssrc: 10000001,
          maxBitrate: 5000000,
          scalabilityMode: "L1T3",
        },
      ];
    }

    // For regular webcam
    return [
      // Simulcast encodings
      {
        ssrc: 11111111,
        maxBitrate: 500000,
        scalabilityMode: "L3T3",
        scaleResolutionDownBy: 4,
      },
      {
        ssrc: 22222222,
        maxBitrate: 1000000,
        scalabilityMode: "L3T3",
        scaleResolutionDownBy: 2,
      },
      {
        ssrc: 33333333,
        maxBitrate: 5000000,
        scalabilityMode: "L3T3",
        scaleResolutionDownBy: 1,
      },
    ];
  }
  /**
   * Applies network throttling for testing
   * @param options Throttling options
   */
  public async applyNetworkThrottle(options: {
    secret: string;
    uplink?: number;
    downlink?: number;
    rtt?: number;
    packetLoss?: number;
  }): Promise<void> {
    this.log("debug", "applyNetworkThrottle() called", options);

    if (!options.secret) {
      this.log("error", "Network throttle secret is required");
      throw new Error("Network throttle secret is required");
    }

    try {
      // Call the protoo request to apply network throttling
      await this.protooRequest("throttleNetwork", {
        secret: options.secret,
        uplink: options.uplink || 0,
        downlink: options.downlink || 0,
        rtt: options.rtt || 0,
        packetLoss: options.packetLoss || 0,
      });

      this.log("info", "Network throttling applied successfully", {
        uplink: options.uplink,
        downlink: options.downlink,
        rtt: options.rtt,
        packetLoss: options.packetLoss,
      });
    } catch (error) {
      this.log("error", "Error applying network throttle", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Resets network throttling
   * @param options Reset options
   */
  public async resetNetworkThrottle(options: {
    secret: string;
    silent?: boolean;
  }): Promise<void> {
    this.log("debug", "resetNetworkThrottle() called", {
      secret: "***",
      silent: options.silent,
    });

    if (!options.secret) {
      this.log("error", "Network throttle secret is required");
      throw new Error("Network throttle secret is required");
    }

    try {
      // Call the protoo request to reset network throttling
      await this.protooRequest("resetNetworkThrottling", {
        secret: options.secret,
      });

      this.log("info", "Network throttling reset successfully");
    } catch (error) {
      this.log("error", "Error resetting network throttle", {
        error: error instanceof Error ? error.message : String(error),
        silent: options.silent,
      });

      // Only rethrow if not silent
      if (!options.silent) {
        throw error;
      }
    }
  }

  // Public method to change display name via Protoo
  public async changeDisplayNameOnServer(displayName: string): Promise<void> {
    this.log("info", "Requesting display name change on server", {
      displayName,
    });
    try {
      await this.protooRequest("changeDisplayName", { displayName });
      this.log("info", "Display name change request sent successfully");
    } catch (error) {
      this.log("error", "Failed to send display name change request", {
        error,
      });
      throw error; // Re-throw the error to be handled by the caller
    }
  }
  /**
   * Gets all active consumer IDs
   * @returns Array of consumer IDs
   */
  public async getConsumerIds(): Promise<string[]> {
    this.log("debug", "getConsumerIds() called");

    // Return array of consumer IDs from the consumers Map
    return Array.from(this.consumers.keys());
  }

  /**
   * Gets a specific consumer by ID
   * @param consumerId The consumer ID to retrieve
   * @returns The consumer object or null if not found
   */
  public async getConsumer(consumerId: string): Promise<Consumer | null> {
    this.log("debug", "getConsumer() called", { consumerId });

    // Get the consumer from the Map
    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      this.log("warn", "Consumer not found", { consumerId });
      return null;
    }

    // Convert the mediasoup consumer to our Consumer type
    const consumerInfo: Consumer = {
      id: consumer.id,
      locallyPaused: consumer.locallyPaused,
      remotelyPaused: consumer.remotelyPaused,
      track: consumer.track,
      codec: consumer.rtpParameters.codecs[0].mimeType.split("/")[1],
      rtpParameters: consumer.rtpParameters,
    };

    // Add additional properties if available
    if (consumer.type !== "simple") {
      consumerInfo.spatialLayers = consumer.spatialLayers;
      consumerInfo.temporalLayers = consumer.temporalLayers;
      consumerInfo.currentSpatialLayer = consumer.currentSpatialLayer;
      consumerInfo.currentTemporalLayer = consumer.currentTemporalLayer;
      consumerInfo.preferredSpatialLayer = consumer.preferredSpatialLayer;
      consumerInfo.preferredTemporalLayer = consumer.preferredTemporalLayer;
      consumerInfo.priority = consumer.priority;
    }

    return consumerInfo;
  }
  /**
   * Gets statistics for a transport
   * @param type Type of transport ('send' or 'recv')
   * @returns Transport statistics or null if transport doesn't exist
   */
  public async getTransportStats(type: "send" | "recv"): Promise<any> {
    this.log("debug", "getTransportStats() called", { type });

    const transport = type === "send" ? this.sendTransport : this.recvTransport;

    if (!transport) {
      this.log("warn", `${type} transport not created`);
      return null;
    }

    try {
      const stats = await transport.getStats();
      this.log("debug", `Got ${type} transport stats`);
      return stats;
    } catch (error) {
      this.log("error", `Failed to get ${type} transport stats`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets local statistics for a transport
   * @param type Type of transport ('send' or 'recv')
   * @returns Local transport statistics or null if transport doesn't exist
   */
  public async getTransportLocalStats(type: "send" | "recv"): Promise<any> {
    this.log("debug", "getTransportLocalStats() called", { type });

    const transport = type === "send" ? this.sendTransport : this.recvTransport;

    if (!transport) {
      this.log("warn", `${type} transport not created`);
      return null;
    }

    try {
      // For local stats, we can look at the RTCPeerConnection
      // @ts-ignore - accessing internal handler
      const pc = transport._handler._pc;

      if (!pc) {
        this.log("warn", "No RTCPeerConnection found in transport");
        return null;
      }

      const stats = await pc.getStats();
      this.log("debug", `Got ${type} transport local stats`);
      return stats;
    } catch (error) {
      this.log("error", `Failed to get ${type} transport local stats`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  /**
   * Gets statistics for a producer
   * @param producerId The producer ID
   * @returns Producer statistics or null if producer doesn't exist
   */
  public async getProducerStats(producerId: string): Promise<any> {
    this.log("debug", "getProducerStats() called", { producerId });

    // Find the producer
    let producer;
    for (const [kind, prod] of Array.from(this.producers.entries())) {
      if (prod.id === producerId) {
        producer = prod;
        break;
      }
    }

    if (!producer) {
      this.log("warn", "Producer not found", { producerId });
      return null;
    }

    try {
      const stats = await producer.getStats();
      this.log("debug", "Got producer stats", { producerId });
      return stats;
    } catch (error) {
      this.log("error", "Failed to get producer stats", {
        error: error instanceof Error ? error.message : String(error),
        producerId,
      });
      throw error;
    }
  }
  /**
   * Gets statistics for a consumer
   * @param consumerId The consumer ID
   * @returns Consumer statistics or null if consumer doesn't exist
   */
  public async getConsumerStats(consumerId: string): Promise<any> {
    this.log("debug", "getConsumerStats() called", { consumerId });

    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      this.log("warn", "Consumer not found", { consumerId });
      return null;
    }

    try {
      const stats = await consumer.getStats();
      this.log("debug", "Got consumer stats", { consumerId });
      return stats;
    } catch (error) {
      this.log("error", "Failed to get consumer stats", {
        error: error instanceof Error ? error.message : String(error),
        consumerId,
      });
      throw error;
    }
  }

  /**
   * Gets local statistics for a consumer
   * @param consumerId The consumer ID
   * @returns Consumer local statistics or null if consumer doesn't exist
   */
  public async getConsumerLocalStats(consumerId: string): Promise<any> {
    this.log("debug", "getConsumerLocalStats() called", { consumerId });

    const consumer = this.consumers.get(consumerId);

    if (!consumer) {
      this.log("warn", "Consumer not found", { consumerId });
      return null;
    }

    try {
      // For local stats, we need to get the receiver associated with this track
      const track = consumer.track;

      if (!track) {
        this.log("warn", "No track in consumer", { consumerId });
        return null;
      }

      // Get the receiver associated with this track
      // @ts-ignore - accessing internal methods
      const receiver = this.recvTransport._handler._pc
        .getReceivers()
        .find((r: RTCRtpReceiver) => r.track === track);

      if (!receiver) {
        this.log("warn", "No receiver found for consumer track", {
          consumerId,
        });
        return null;
      }

      const stats = await receiver.getStats();
      this.log("debug", "Got consumer local stats", { consumerId });
      return stats;
    } catch (error) {
      this.log("error", "Failed to get consumer local stats", {
        error: error instanceof Error ? error.message : String(error),
        consumerId,
      });
      throw error;
    }
  }
  /**
   * Gets statistics for a data consumer
   * @param dataConsumerId The data consumer ID
   * @returns Data consumer statistics or null if data consumer doesn't exist
   */
  public async getDataConsumerStats(dataConsumerId: string): Promise<any> {
    this.log("debug", "getDataConsumerStats() called", { dataConsumerId });

    const dataConsumer = this.dataConsumers.get(dataConsumerId);

    if (!dataConsumer) {
      this.log("warn", "Data consumer not found", { dataConsumerId });
      return null;
    }

    try {
      const stats = await dataConsumer.getStats();
      this.log("debug", "Got data consumer stats", { dataConsumerId });
      return stats;
    } catch (error) {
      this.log("error", "Failed to get data consumer stats", {
        error: error instanceof Error ? error.message : String(error),
        dataConsumerId,
      });
      throw error;
    }
  }

  /**
   * Gets statistics for data producers
   * @param label Optional label to filter data producers (e.g., 'chat', 'bot')
   * @returns Data producer statistics
   */
  public async getDataProducerStats(label?: string): Promise<any> {
    this.log("debug", "getDataProducerStats() called", { label });

    const stats: Record<string, any> = {};

    for (const [dataProducerLabel, dataProducer] of Array.from(
      this.dataProducers.entries()
    )) {
      if (label && dataProducerLabel !== label) {
        continue;
      }

      try {
        stats[dataProducerLabel] = await dataProducer.getStats();
      } catch (error) {
        this.log("error", "Failed to get data producer stats", {
          error: error instanceof Error ? error.message : String(error),
          label: dataProducerLabel,
        });
      }
    }

    return stats;
  }
  /**
   * Sets the maximum spatial layer for video simulcast
   * @param producerId The producer ID
   * @param spatialLayer The spatial layer to set (0, 1, 2, etc.)
   */
  public async setMaxSpatialLayer(
    producerId: string,
    spatialLayer: number
  ): Promise<void> {
    this.log("debug", "setMaxSpatialLayer() called", {
      producerId,
      spatialLayer,
    });

    if (spatialLayer < 0) {
      this.log("error", "Invalid spatial layer value", { spatialLayer });
      return;
    }

    // Find the producer
    let producer;
    for (const [kind, prod] of Array.from(this.producers.entries())) {
      if (prod.id === producerId) {
        producer = prod;
        break;
      }
    }

    if (!producer) {
      this.log("warn", "Producer not found", { producerId });
      throw new Error(`Producer not found: ${producerId}`);
    }

    try {
      // Call the producer's setMaxSpatialLayer method
      await producer.setMaxSpatialLayer(spatialLayer);

      // Also inform the server
      await this.protooRequest("setProducerPreferredLayers", {
        producerId,
        spatialLayer,
      });

      this.log("info", "Maximum spatial layer set successfully", {
        producerId,
        spatialLayer,
      });
    } catch (error) {
      this.log("error", "Error setting max spatial layer", {
        error: error instanceof Error ? error.message : String(error),
        producerId,
        spatialLayer,
      });
      throw error;
    }
  }

  public getCodecCapabilities(): {
    vp8: boolean;
    h264: boolean;
    vp9: boolean;
    av1: boolean;
  } {
    if (!this.device || !this.device.rtpCapabilities) {
      return { vp8: false, h264: false, vp9: false, av1: false };
    }

    const codecs = this.device.rtpCapabilities.codecs || [];
    return {
      vp8: codecs.some(
        (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/vp8"
      ),
      h264: codecs.some(
        (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/h264"
      ),
      vp9: codecs.some(
        (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/vp9"
      ),
      av1: codecs.some(
        (c: RtpCodecCapability) => c.mimeType.toLowerCase() === "video/av1"
      ),
    };
  }

  public getRtpCapabilities() {
    return this.device?.rtpCapabilities;
  }

  // Add this method to handle ICE connection state changes
  private handleIceConnectionStateChange(
    transport: any,
    type: "send" | "recv"
  ): void {
    if (!transport) return;

    transport.on(
      "connectionstatechange",
      async (state: TransportConnectionState) => {
        this.log(
          "info",
          `${type} transport connection state changed: ${state}`
        );

        switch (state) {
          case "failed":
            this.log(
              "warn",
              `${type} transport connection failed, attempting to restart ICE`
            );
            try {
              await this.restartIce();
            } catch (error) {
              this.log("error", `Failed to restart ICE for ${type} transport`, {
                error: (error as Error).message,
              });
            }
            break;

          case "disconnected":
            this.log(
              "warn",
              `${type} transport disconnected, monitoring for recovery`
            );
            // Set a timeout to check if we recover
            setTimeout(() => {
              if (transport.connectionState === "disconnected") {
                this.log(
                  "warn",
                  `${type} transport still disconnected, attempting to restart ICE`
                );
                this.restartIce().catch((error) => {
                  this.log(
                    "error",
                    `Failed to restart ICE for ${type} transport`,
                    {
                      error: (error as Error).message,
                    }
                  );
                });
              }
            }, 5000); // Wait 5 seconds before attempting recovery
            break;

          case "connected":
            this.log("info", `${type} transport connected successfully`);
            break;

          case "closed":
            this.log("info", `${type} transport closed`);
            break;
        }
      }
    );
  }
}
