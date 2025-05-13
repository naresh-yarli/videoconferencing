// NOTE: This is a modified copy of the original webrtc-service.ts
// converted to JavaScript and adapted for API Key authentication.

// Import necessary libraries globally exposed by CDN links in index.html
// Assume UMD builds expose globals directly
// const Device = mediasoupClient.Device;
// const Peer = protooClient.Peer;
// const WebSocketTransport = protooClient.WebSocketTransport;
// uuidv4 should be available globally from its CDN scriptv4; // Keep this commented or remove if direct uuidv4 works

import { Device } from "mediasoup-client";
import * as protooClient from "protoo-client";
import { v4 as uuidv4 } from "uuid";

export class WebRTCService {
  #apiUrl = ""; // Private field for API URL
  #apiKey = ""; // Private field for API Key

  #streamId = null;
  #peerId = null;
  #isConnected = false;
  #isInitialized = false;

  // Mediasoup and Protoo specific objects
  #device = null;
  #protooWebSocket = null;
  #protooPeer = null;
  #sendTransport = null;
  #recvTransport = null;
  #producers = new Map(); // Map<MediaKind, any>
  #consumers = new Map(); // Map<string, any>

  #localStream = null;
  #remoteStreams = new Map(); // Map<string, MediaStream>
  #videoElement = null;
  #currentConnectionAttemptId = null;

  // Callbacks
  #onRemoteTrackCallback = null; // ((track: MediaStreamTrack, streamId: string | null) => void) | null
  #onDisconnectCallback = null; // (() => void) | null

  constructor(apiUrl, apiKey) {
    // Add checks for imported modules
    if (!Device) {
      throw new Error("mediasoup-client Device class not imported correctly.");
    }
    if (
      !protooClient ||
      !protooClient.Peer ||
      !protooClient.WebSocketTransport
    ) {
      throw new Error(
        "protoo-client Peer or WebSocketTransport not imported correctly."
      );
    }
    if (!uuidv4) {
      throw new Error("uuidv4 function not imported correctly.");
    }

    if (!apiUrl || !apiKey) {
      throw new Error(
        "API URL and API Key are required for WebRTCService instantiation."
      );
    }
    this.#apiUrl = apiUrl.replace(/\/$/, ""); // Remove trailing slash if present
    this.#apiKey = apiKey;
    this.log("debug", "WebRTCService (API Key Version) constructor called.");
    // Bind necessary methods
    this.handleProtooOpen = this.handleProtooOpen.bind(this);
    this.handleProtooFail = this.handleProtooFail.bind(this);
    this.handleProtooRequest = this.handleProtooRequest.bind(this);
    this.handleProtooNotification = this.handleProtooNotification.bind(this);
    this.handleProtooClose = this.handleProtooClose.bind(this);
  }

  log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      peerId: this.#peerId,
      streamId: this.#streamId,
    };
    if (data !== undefined) {
      try {
        // Avoid logging large objects and handle circular references
        logEntry.data =
          JSON.stringify(data, null, 2).substring(0, 500) +
          (JSON.stringify(data).length > 500 ? "..." : "");
      } catch (e) {
        logEntry.data = "[Unserializable data]";
      }
    }

    const logString = `[MS-WebRTC-APIKEY] ${message}`;
    switch (level) {
      case "error":
        console.error(logString, logEntry);
        break;
      case "warn":
        console.warn(logString, logEntry);
        break;
      case "debug":
        console.debug(logString, logEntry);
        break;
      default:
        console.log(logString, logEntry);
    }

    // Also log to the page's log area if available (handled in main.js)
    const logArea = document.getElementById("logArea");
    if (logArea) {
      logArea.textContent += `${timestamp} [${level.toUpperCase()}] ${message}${
        data ? ` ${JSON.stringify(logEntry.data)}` : ""
      }\n`;
      logArea.scrollTop = logArea.scrollHeight; // Scroll to bottom
    }
  }

  // --- Public API Methods ---

  onRemoteTrack(callback) {
    this.#onRemoteTrackCallback = callback;
  }

  onDisconnect(callback) {
    this.#onDisconnectCallback = callback;
  }

  async startPublishing(streamId) {
    this.log("info", "Attempting to start publishing...", { streamId });

    if (this.#isConnected || this.#currentConnectionAttemptId) {
      this.log(
        "warn",
        `Connection attempt already in progress (currentId: ${
          this.#currentConnectionAttemptId
        }), ignoring new request.`
      );
      return this.#localStream;
    }

    this.#streamId = streamId;
    this.#peerId = `pub-${uuidv4()}`;
    const localPeerId = this.#peerId;
    const localStreamId = this.#streamId;

    const attemptId = uuidv4();
    this.#currentConnectionAttemptId = attemptId;
    this.log("info", `Starting connection attempt: ${attemptId}`);

    try {
      const { webSocketUrl, authToken } = await this.getConnectionInfo(
        "publisher"
      );

      await this.connectProtoo(
        webSocketUrl,
        authToken,
        "publisher",
        localPeerId,
        localStreamId
      );

      if (this.#currentConnectionAttemptId !== attemptId) {
        this.log(
          "warn",
          `Aborting stale publishing attempt ${attemptId} after connect`
        );
        return null;
      }

      this.#device = new Device();

      if (this.#currentConnectionAttemptId !== attemptId) {
        this.log(
          "warn",
          `Aborting stale publishing attempt ${attemptId} before device load`
        );
        return null;
      }

      const routerRtpCapabilities = await this.protooRequest(
        "getRouterRtpCapabilities"
      );
      await this.#device.load({ routerRtpCapabilities });
      this.log("info", "Mediasoup device loaded.", {
        canProduceAudio: this.#device.canProduce("audio"),
        canProduceVideo: this.#device.canProduce("video"),
      });

      if (this.#currentConnectionAttemptId !== attemptId) {
        this.log(
          "warn",
          `Aborting stale publishing attempt ${attemptId} before join`
        );
        return null;
      }

      await this.protooRequest("join", {
        displayName: `publisher-${this.#peerId}`.substring(0, 20),
        device: { flag: "apikey-test-client", name: "Browser", version: "1.0" },
        rtpCapabilities: this.#device.rtpCapabilities,
        sctpCapabilities: this.#device.sctpCapabilities,
      });
      this.log("info", "Protoo 'join' request sent and acknowledged.");

      if (this.#currentConnectionAttemptId !== attemptId) {
        this.log(
          "warn",
          `Aborting stale publishing attempt ${attemptId} before create transport`
        );
        return null;
      }

      await this.createSendTransport();

      this.#localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      this.log("info", "Local media stream obtained.");

      const audioTrack = this.#localStream.getAudioTracks()[0];
      if (audioTrack && this.#device.canProduce("audio")) {
        await this.createProducer(audioTrack, "audio");
      } else {
        this.log("warn", "Cannot produce audio or no audio track found.");
      }

      const videoTrack = this.#localStream.getVideoTracks()[0];
      if (videoTrack && this.#device.canProduce("video")) {
        await this.createProducer(videoTrack, "video");
      } else {
        this.log("warn", "Cannot produce video or no video track found.");
      }

      this.#isInitialized = true;
      this.log("info", "Publishing setup complete.");
      return this.#localStream;
    } catch (error) {
      this.log("error", "Failed to start publishing", { error: error.message });
      await this.closeConnection();
      throw error;
    }
  }

  async startViewing(streamId, videoElement) {
    this.log("info", "Attempting to start viewing...", { streamId });

    if (this.#isConnected || this.#currentConnectionAttemptId) {
      this.log(
        "warn",
        `Connection attempt already in progress (currentId: ${
          this.#currentConnectionAttemptId
        }), ignoring new request.`
      );
      return;
    }

    this.#streamId = streamId;
    this.#peerId = `view-${uuidv4()}`;
    this.#videoElement = videoElement;
    const localPeerId = this.#peerId;
    const localStreamId = this.#streamId;

    const attemptId = uuidv4();
    this.#currentConnectionAttemptId = attemptId;
    this.log("info", `Starting connection attempt: ${attemptId}`);

    try {
      const { webSocketUrl, authToken } = await this.getConnectionInfo(
        "viewer"
      );

      await this.connectProtoo(
        webSocketUrl,
        authToken,
        "viewer",
        localPeerId,
        localStreamId
      );

      if (this.#currentConnectionAttemptId !== attemptId) {
        this.log(
          "warn",
          `Aborting stale viewing attempt ${attemptId} after connect`
        );
        return;
      }

      this.#device = new Device();

      if (this.#currentConnectionAttemptId !== attemptId) {
        this.log(
          "warn",
          `Aborting stale viewing attempt ${attemptId} before device load`
        );
        return;
      }

      const routerRtpCapabilities = await this.protooRequest(
        "getRouterRtpCapabilities"
      );
      await this.#device.load({ routerRtpCapabilities });
      this.log("info", "Mediasoup device loaded.");

      if (this.#currentConnectionAttemptId !== attemptId) {
        this.log(
          "warn",
          `Aborting stale viewing attempt ${attemptId} before create transport/join`
        );
        return;
      }

      await this.createRecvTransport();

      await this.protooRequest("join", {
        displayName: `viewer-${this.#peerId}`.substring(0, 20),
        device: { flag: "apikey-test-client", name: "Browser", version: "1.0" },
        rtpCapabilities: this.#device.rtpCapabilities,
        sctpCapabilities: this.#device.sctpCapabilities,
      });
      this.log("info", "Protoo 'join' request sent and acknowledged.");

      this.#isInitialized = true;
      this.log("info", "Viewing setup complete. Waiting for tracks...");
    } catch (error) {
      this.log("error", "Failed to start viewing", { error: error.message });
      await this.closeConnection();
      throw error;
    }
  }

  async closeConnection() {
    this.log("info", "Closing connection...");
    this.#isConnected = false;
    this.#isInitialized = false;
    this.#currentConnectionAttemptId = null;

    if (this.#protooPeer) {
      try {
        this.#protooPeer.close();
      } catch (e) {
        /* ignore */
      }
      this.#protooPeer = null;
    }
    if (this.#protooWebSocket) {
      try {
        this.#protooWebSocket.close();
      } catch (e) {
        /* ignore */
      }
      this.#protooWebSocket = null;
    }
    if (this.#sendTransport) {
      try {
        this.#sendTransport.close();
      } catch (e) {
        /* ignore */
      }
      this.#sendTransport = null;
    }
    if (this.#recvTransport) {
      try {
        this.#recvTransport.close();
      } catch (e) {
        /* ignore */
      }
      this.#recvTransport = null;
    }
    this.#producers.forEach((producer) => {
      try {
        producer.close();
      } catch (e) {
        /* ignore */
      }
    });
    this.#producers.clear();
    this.#consumers.forEach((consumer) => {
      try {
        consumer.close();
      } catch (e) {
        /* ignore */
      }
    });
    this.#consumers.clear();
    if (this.#localStream) {
      this.#localStream.getTracks().forEach((track) => track.stop());
      this.#localStream = null;
    }
    this.#remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.#remoteStreams.clear();

    this.#device = null;
    this.#streamId = null;
    this.#peerId = null;
    this.#videoElement = null;

    if (this.#onDisconnectCallback) {
      try {
        this.#onDisconnectCallback();
      } catch (e) {
        /*ignore*/
      }
    }
    this.log("info", "Connection closed and resources cleaned up.");
  }

  // --- Internal Methods ---

  async getConnectionInfo(type) {
    this.log("debug", `Fetching connection info for ${type}...`, {
      streamId: this.#streamId,
    });
    if (!this.#streamId) throw new Error("Stream ID not set");
    if (!this.#apiKey) throw new Error("API Key not set");
    if (!this.#apiUrl) throw new Error("API URL not set");

    const endpointPath =
      type === "publisher"
        ? `/api/v1/webrtc/publish/${this.#streamId}`
        : `/api/v1/webrtc/view/${this.#streamId}`;

    const endpoint = `${this.#apiUrl}${endpointPath}`;

    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#apiKey}`,
        // REMOVED "X-API-Key": this.#apiKey,
        // Or potentially: 'Authorization': `ApiKey ${this.#apiKey}` - Keep this commented
      };

      this.log("debug", "Making request to backend endpoint", {
        endpoint,
        // Log Authorization header but redact the token part
        headers: { ...headers, Authorization: "Bearer ***REDACTED***" },
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({}),
      });

      this.log("debug", "Received response from backend", {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = {
            detail: `HTTP error ${response.status} - ${response.statusText}`,
          };
        }
        this.log("error", "Backend connection info request failed", {
          status: response.status,
          errorData,
        });
        throw new Error(errorData.detail || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (!data.webSocketUrl || !data.authToken) {
        this.log(
          "error",
          "Missing webSocketUrl or authToken in backend response",
          { data }
        );
        throw new Error(
          "Missing webSocketUrl or authToken in backend response"
        );
      }
      this.log("debug", "Successfully fetched connection info.");
      return { webSocketUrl: data.webSocketUrl, authToken: data.authToken };
    } catch (error) {
      this.log("error", "Failed to get connection info from backend", {
        error: error.message,
      });
      throw error;
    }
  }

  connectProtoo(url, token, connectionType, peerId, streamId) {
    this.log("debug", "Connecting Protoo WebSocket...", {
      url,
      peerId,
      streamId,
    });
    if (!peerId || !streamId) {
      const errMsg = `peerId ('${peerId}') or streamId ('${streamId}') not valid when calling connectProtoo`;
      this.log("error", errMsg);
      throw new Error(errMsg);
    }

    const protooUrl = `${url}?roomId=${streamId}&peerId=${peerId}&token=${token}&connectionType=${connectionType}`;
    this.log("debug", "Constructed Protoo URL", { protooUrl });

    // Ensure WebSocketTransport is available (imported)
    if (typeof protooClient.WebSocketTransport === "undefined") {
      const errMsg =
        "protooClient.WebSocketTransport not found. Ensure protoo-client library is loaded/imported.";
      this.log("error", errMsg);
      throw new Error(errMsg);
    }

    const transport = new protooClient.WebSocketTransport(protooUrl);
    this.#protooWebSocket = transport;

    return new Promise((resolve, reject) => {
      // Ensure Peer is available (imported)
      if (typeof protooClient.Peer === "undefined") {
        const errMsg =
          "protooClient.Peer not found. Ensure protoo-client library is loaded/imported.";
        this.log("error", errMsg);
        reject(new Error(errMsg));
        return;
      }

      const peer = new protooClient.Peer(transport);

      peer.on("open", () => {
        this.log("info", "Protoo connection opened.");
        this.#isConnected = true;
        this.#protooPeer = peer;
        this.handleProtooOpen();
        resolve();
      });
      peer.on("failed", (error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.log("error", "Protoo connection failed.", { error: errorMessage });
        this.#protooPeer = null;
        this.#isConnected = false;
        this.handleProtooFail();
        reject(new Error(`Protoo connection failed: ${errorMessage}`));
      });
      peer.on("disconnected", () => {
        this.log("warn", "Protoo connection disconnected.");
        if (this.#isConnected) {
          this.#isConnected = false;
          this.#protooPeer = null;
          if (this.#sendTransport) this.#sendTransport.close();
          if (this.#recvTransport) this.#recvTransport.close();
          if (this.#onDisconnectCallback) {
            try {
              this.#onDisconnectCallback();
            } catch (e) {
              /*ignore*/
            }
          }
        }
      });
      peer.on("close", () => {
        this.log("info", "Protoo connection closed.");
        if (this.#isConnected) {
          this.#isConnected = false;
          this.#protooPeer = null;
          this.handleProtooClose();
        }
      });

      peer.on("request", this.handleProtooRequest); // Already bound in constructor
      peer.on("notification", this.handleProtooNotification); // Already bound in constructor
    });
  }

  async protooRequest(method, data) {
    if (!this.#protooPeer || !this.#isConnected) {
      throw new Error(
        `Protoo Peer not initialized or not connected for request: ${method}`
      );
    }
    this.log("debug", `Sending protoo request --> method: ${method}`, { data });
    try {
      const result = await this.#protooPeer.request(method, data);
      this.log("debug", `<-- Received protoo response: ${method}`, { result });
      return result;
    } catch (error) {
      this.log("error", `<-- Received protoo error response: ${method}`, {
        error: error instanceof Error ? error.message : String(error),
        method: method,
      });
      throw error;
    }
  }

  // --- Mediasoup Transport Creation ---
  async createSendTransport() {
    if (!this.#device) throw new Error("Device not loaded");
    this.log("debug", "Creating send transport...");

    const transportInfo = await this.protooRequest("createWebRtcTransport", {
      forceTcp: false,
      producing: true,
      consuming: false,
      sctpCapabilities: this.#device.sctpCapabilities,
    });

    this.#sendTransport = this.#device.createSendTransport(transportInfo);

    this.#sendTransport.on(
      "connect",
      async ({ dtlsParameters }, callback, errback) => {
        this.log("debug", "Send transport connect event");
        this.protooRequest("connectWebRtcTransport", {
          transportId: this.#sendTransport.id,
          dtlsParameters,
        })
          .then(callback)
          .catch(errback);
      }
    );

    this.#sendTransport.on(
      "produce",
      async ({ kind, rtpParameters, appData }, callback, errback) => {
        this.log("debug", "Send transport produce event", { kind, appData });
        try {
          const { id } = await this.protooRequest("produce", {
            transportId: this.#sendTransport.id,
            kind,
            rtpParameters,
            appData,
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      }
    );

    this.#sendTransport.on(
      "producedata",
      async (parameters, callback, errback) => {
        this.log("debug", "Send transport producedata event");
        try {
          const { id } = await this.protooRequest("produceData", {
            transportId: this.#sendTransport.id,
            ...parameters,
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      }
    );

    this.#sendTransport.on("connectionstatechange", (state) => {
      this.log("info", `Send transport connection state: ${state}`);
    });

    this.log("info", "Send transport created", { id: this.#sendTransport.id });
  }

  async createRecvTransport() {
    if (!this.#device) throw new Error("Device not loaded");
    this.log("debug", "Creating recv transport...");

    const transportInfo = await this.protooRequest("createWebRtcTransport", {
      forceTcp: false,
      producing: false,
      consuming: true,
      sctpCapabilities: this.#device.sctpCapabilities,
    });

    this.#recvTransport = this.#device.createRecvTransport(transportInfo);

    this.#recvTransport.on(
      "connect",
      ({ dtlsParameters }, callback, errback) => {
        this.log("debug", "Recv transport 'connect' event triggered.");
        this.protooRequest("connectWebRtcTransport", {
          transportId: this.#recvTransport.id,
          dtlsParameters,
        })
          .then(() => {
            this.log(
              "debug",
              "protooRequest('connectWebRtcTransport') succeeded."
            );
            callback();
          })
          .catch((error) => {
            this.log(
              "error",
              "protooRequest('connectWebRtcTransport') failed.",
              { error }
            );
            errback(error);
          });
      }
    );

    this.#recvTransport.on("connectionstatechange", (state) => {
      this.log("info", `Recv transport connection state: ${state}`);
    });
    this.log("info", "Recv transport created", { id: this.#recvTransport.id });
  }

  // --- Mediasoup Producer/Consumer Creation ---
  async createProducer(track, kind) {
    if (!this.#sendTransport) throw new Error("Send transport not created");
    this.log("debug", `Creating ${kind} producer...`);
    try {
      const producer = await this.#sendTransport.produce({ track });
      this.#producers.set(kind, producer);
      this.log("info", `${kind} producer created`, { id: producer.id });

      producer.on("trackended", () => {
        this.log("warn", `${kind} track ended.`);
        // Consider closing the producer?
        // this.#producers.delete(kind);
        // this.protooRequest('closeProducer', { producerId: producer.id }).catch(()=>{});
      });
      producer.on("transportclose", () => {
        this.log("warn", `${kind} producer transport closed.`);
        this.#producers.delete(kind);
      });
    } catch (error) {
      this.log("error", `Failed to create ${kind} producer`, {
        error: error.message,
      });
      track.stop();
    }
  }

  async createConsumer(consumerInfo) {
    if (!this.#recvTransport) {
      this.log("error", "Cannot create consumer, Recv transport not created");
      throw new Error("Recv transport not created");
    }
    if (!this.#device || !this.#device.loaded) {
      this.log("error", "Cannot create consumer, Device not loaded");
      throw new Error("Device not loaded");
    }

    const {
      peerId, // From server appData
      producerId,
      id,
      kind,
      rtpParameters,
      type, // mediasoup consumer type ('simple', 'simulcast', 'svc')
      appData, // Original appData from server producer
      producerPaused,
    } = consumerInfo;
    this.log("debug", "Attempting to create consumer...", {
      id,
      producerId,
      kind,
    });

    try {
      const consumer = await this.#recvTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData: { ...appData, peerId }, // Pass server producer's appData and peerId
      });
      this.#consumers.set(consumer.id, consumer);
      this.log("info", "Consumer created", { id: consumer.id, kind, type });

      const { track } = consumer;
      const stream = new MediaStream();
      stream.addTrack(track);
      this.#remoteStreams.set(consumer.id, stream); // Store stream by consumer ID

      // Handle the track using callback or direct element manipulation
      if (this.#onRemoteTrackCallback) {
        this.#onRemoteTrackCallback(track, this.#streamId);
      }

      if (this.#videoElement && kind === "video") {
        this.log("debug", "Setting video element srcObject", {
          consumerId: consumer.id,
        });
        this.#videoElement.srcObject = stream;
        // Autoplay is handled by the browser/component, but we can try
        this.#videoElement
          .play()
          .catch((e) =>
            this.log(
              "warn",
              "Video play failed, likely requires user interaction.",
              { error: e.message }
            )
          );
      } else if (kind === "audio") {
        // Create an audio element dynamically? Or expect one to be passed?
        // For simplicity, just log audio track received
        this.log("info", "Received audio track, not attaching to an element.", {
          consumerId: consumer.id,
        });
        // const audioElement = document.createElement('audio');
        // audioElement.srcObject = stream;
        // audioElement.play().catch(e => this.log('warn', 'Audio play failed'));
      }

      consumer.on("trackended", () => {
        this.log("warn", `Consumer track ended`, { id: consumer.id });
        this.#consumers.delete(consumer.id);
        this.#remoteStreams.delete(consumer.id);
        // Potentially update UI or stop associated video element
        if (this.#videoElement && this.#videoElement.srcObject === stream) {
          this.#videoElement.srcObject = null;
        }
      });
      consumer.on("transportclose", () => {
        this.log("warn", `Consumer transport closed`, { id: consumer.id });
        this.#consumers.delete(consumer.id);
        this.#remoteStreams.delete(consumer.id);
        if (this.#videoElement && this.#videoElement.srcObject === stream) {
          this.#videoElement.srcObject = null;
        }
      });

      if (producerPaused) {
        this.log("info", `Consumer created for a paused producer`, {
          id: consumer.id,
        });
        // Optionally, request server to resume it
        // await this.protooRequest('resumeConsumer', { consumerId: consumer.id });
      }

      this.log("debug", "createConsumer completed successfully", {
        consumerId: consumer.id,
      });
    } catch (error) {
      this.log("error", "Failed to create consumer", { error: error.message });
      // Don't re-throw, allow other consumers to potentially be created
    }
  }

  // --- Protoo Event Handlers ---
  handleProtooOpen() {
    this.log("info", "handleProtooOpen");
  }

  handleProtooFail() {
    this.log("error", "handleProtooFail");
    this.closeConnection(); // Attempt cleanup
  }

  handleProtooRequest(request, accept, reject) {
    this.log("debug", `handleProtooRequest <-- method: ${request.method}`, {
      request,
    });

    switch (request.method) {
      case "newConsumer": {
        const consumerInfo = request.data;
        this.log("info", "'newConsumer' REQUEST received", { consumerInfo });
        this.createConsumer(consumerInfo)
          .then(() => {
            this.log("debug", "'newConsumer' request processed successfully.");
            accept();
          })
          .catch((error) => {
            this.log("error", "Failed to create consumer from request", {
              error: error.message,
            });
            reject(error);
          });
        break;
      }
      case "newDataConsumer": {
        const dataConsumerInfo = request.data;
        this.log("info", "'newDataConsumer' REQUEST received", {
          dataConsumerInfo,
        });
        // TODO: Implement data consumer handling if needed
        accept(); // Acknowledge for now
        break;
      }
      default: {
        this.log(
          "warn",
          `Ignoring unknown protoo request method: ${request.method}`
        );
        reject(new Error(`Unknown method '${request.method}'`));
      }
    }
  }

  handleProtooNotification(notification) {
    this.log(
      "debug",
      `handleProtooNotification received <-- method: ${notification.method}`,
      { notification }
    );

    switch (notification.method) {
      case "producerScore":
      case "consumerScore":
      case "downlinkBwe":
      case "mediasoup-version":
        // Known notifications we might ignore for this simple tester
        this.log(
          "debug",
          `'${notification.method}' notification received, ignoring.`,
          notification.data
        );
        break;
      case "consumerClosed":
        this.log(
          "info",
          `'consumerClosed' notification received`,
          notification.data
        );
        // TODO: Find and close the corresponding consumer client-side
        break;
      case "consumerPaused":
        this.log(
          "info",
          `'consumerPaused' notification received`,
          notification.data
        );
        // TODO: Handle UI indication for paused consumer
        break;
      case "consumerResumed":
        this.log(
          "info",
          `'consumerResumed' notification received`,
          notification.data
        );
        // TODO: Handle UI indication for resumed consumer
        break;
      // Add cases for other relevant notifications like producer closed/paused etc.
      default: {
        this.log(
          "warn",
          `Ignoring unknown protoo notification method: ${notification.method}`
        );
      }
    }
  }

  handleProtooClose() {
    this.log("info", "handleProtooClose");
    this.#isConnected = false;
    // Actual cleanup is handled by the 'disconnected' or explicit closeConnection
  }
}
