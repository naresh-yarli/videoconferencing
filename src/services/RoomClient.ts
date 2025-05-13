// services/RoomClient.ts
import { WebRTCService } from "@/services/webRTCService";
import { EventEmitter } from "events";
import {
  Device,
  Me,
  Peer,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
  Notification,
  AuthConfig,
} from "../types";
import Logger from "@/services/Logger";
import {
  roomActions,
  meActions,
  peersActions,
  producersActions,
  consumersActions,
  dataProducersActions,
  dataConsumersActions,
  notificationsActions,
} from "@/redux/store";

export class RoomClient extends EventEmitter {
  private logger: Logger;

  private webrtcService: WebRTCService;

  // Core state
  private _roomId: string = "";
  private _peerId: string = "";
  private _displayName: string = "";
  private _device: Device;
  private _roomState: "new" | "connecting" | "connected" | "closed" = "new";

  // Flags and configuration
  private _produce: boolean = true;
  private _consume: boolean = true;
  private _forceTcp: boolean = false;
  private _enableWebcamLayers: boolean = true;
  private _enableSharingLayers: boolean = true;
  private _numSimulcastStreams: number = 3;
  private _simulcastEncodings: any[];
  private _webcamScalabilityMode: string | null = null;
  private _sharingScalabilityMode: string | null = null;

  // Media state
  private _webcamInProgress: boolean = false;
  private _shareInProgress: boolean = false;
  private _audioOnly: boolean = false;
  private _audioOnlyInProgress: boolean = false;
  private _restartIceInProgress: boolean = false;

  // Tracks
  private _localMediaStream: MediaStream | null = null;
  private _micProducer: Producer | null = null;
  private _webcamProducer: Producer | null = null;
  private _shareProducer: Producer | null = null;
  private _chatDataProducer: DataProducer | null = null;
  private _botDataProducer: DataProducer | null = null;
  // Add codec forcing flags
  private _forceVP8: boolean = false;
  private _forceH264: boolean = false;
  private _forceVP9: boolean = false;
  private _forceAV1: boolean = false;

  // State callbacks
  private _store: any = null;

  constructor(config: {
    roomId: string;
    peerId: string;
    displayName: string;
    device: Device;
    produce?: boolean;
    consume?: boolean;
    forceTcp?: boolean;
    enableWebcamLayers?: boolean;
    enableSharingLayers?: boolean;
    numSimulcastStreams?: number;
    webcamScalabilityMode?: string;
    sharingScalabilityMode?: string;
    authConfig: AuthConfig;
    store?: any;
    forceVP8?: boolean;
    forceH264?: boolean;
    forceVP9?: boolean;
    forceAV1?: boolean;
  }) {
    super();
    // Initialize codec preferences
    this._forceVP8 = config.forceVP8 || false;
    this._forceH264 = config.forceH264 || false;
    this._forceVP9 = config.forceVP9 || false;
    this._forceAV1 = config.forceAV1 || false;
    // Initialize logger
    this.logger = new Logger("RoomClient");
    this._roomId = config.roomId;
    this._peerId = config.peerId;
    this._displayName = config.displayName;
    this._device = config.device;

    this._produce = config.produce !== undefined ? config.produce : true;
    this._consume = config.consume !== undefined ? config.consume : true;
    this._forceTcp = config.forceTcp || false;
    this._enableWebcamLayers =
      config.enableWebcamLayers !== undefined
        ? config.enableWebcamLayers
        : true;
    this._enableSharingLayers =
      config.enableSharingLayers !== undefined
        ? config.enableSharingLayers
        : true;
    this._numSimulcastStreams = config.numSimulcastStreams || 3;
    this._webcamScalabilityMode = config.webcamScalabilityMode || null;
    this._sharingScalabilityMode = config.sharingScalabilityMode || null;

    this._store = config.store || null;

    // Initialize the WebRTC service
    this.webrtcService = new WebRTCService(config.authConfig);

    // Configure simulcast encodings (if needed)
    this._simulcastEncodings = this.configureSimulcastEncodings(
      this._numSimulcastStreams
    );

    // Set up event listeners for the WebRTC service
    this.setupServiceEventListeners();

    console.log("RoomClient constructor", {
      roomId: this._roomId,
      peerId: this._peerId,
      displayName: this._displayName,
      device: this._device,
    });
  }

  // Static initialization for Redux store integration
  public static init({ store }: { store?: any } = {}): void {
    console.log("RoomClient.init()");

    if (store) {
      this.prototype._store = store;
    }
  }

  // Core room methods
  public async join(): Promise<void> {
    console.log("join()");

    if (this._roomState !== "new") {
      throw new Error(`Cannot join, room state is ${this._roomState}`);
    }

    this._roomState = "connecting";

    try {
      // Connect to the room
      await this.webrtcService.connect(
        this._roomId,
        this._displayName,
        "publisher"
      );

      this._roomState = "connected";

      // Auto-enable media if produce is enabled
      if (this._produce) {
        // Automatically enable mic
        await this.enableMic();

        // Automatically enable webcam if available in client's cookies/preferences
        // For this example, we'll enable it automatically
        const webcamEnabled = true; // Could be from cookies or user preferences
        if (webcamEnabled) {
          await this.enableWebcam();
        }
      }

      // Emit joined event
      this.emit("joined");
    } catch (error) {
      this.logger.error(
        "join() failed during initial connection or WebRTCService setup",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      this.close(); // Close only if core connection fails

      this.emit("joinFailed", error);
      throw error; // Re-throw critical connection errors
    }

    // Try to enable media, but don't let failures here tear down the whole connection
    if (this._produce && this._roomState === "connected") {
      try {
        await this.enableMic();
      } catch (micError) {
        this.logger.error("enableMic() failed within join()", {
          error:
            micError instanceof Error ? micError.message : String(micError),
        });
        // Notify UI about mic failure if desired
        this.emit("notification", {
          type: "error",
          text: "Could not enable microphone during join.",
        });
      }

      // Conditionally enable webcam
      const urlParams = new URLSearchParams(window.location.search);
      const produceVideoParam = urlParams.get("produceVideo"); // Or a more specific param
      const shouldProduceVideo = produceVideoParam !== "false"; // Default to true

      if (shouldProduceVideo) {
        try {
          await this.enableWebcam();
        } catch (webcamError) {
          this.logger.error("enableWebcam() failed within join()", {
            error:
              webcamError instanceof Error
                ? webcamError.message
                : String(webcamError),
          });
          // Notify UI about webcam failure
          this.emit("notification", {
            type: "error",
            text: "Could not enable webcam during join.",
          });
        }
      }
    }
  }

  public async leave(): Promise<void> {
    console.log("leave()");

    // Close the connection
    await this.webrtcService.closeConnection();

    // Reset state
    this._roomState = "closed";

    // Emit left event
    this.emit("left");
  }

  public close(): void {
    if (this._roomState === "closed") {
      return;
    }
    this._roomState = "closed";

    console.log("close()");

    // Close the connection
    this.webrtcService.closeConnection();

    // Clean up media
    this.cleanupMedia();

    // Emit closed event
    this.emit("closed");
  }

  /**
   * Detects available codec capabilities for video
   * @returns Object containing codec support information
   */
  public getCodecCapabilities(): {
    vp8: boolean;
    h264: boolean;
    vp9: boolean;
    av1: boolean;
  } {
    if (!this.webrtcService) {
      this.logger.warn("WebRTC service not initialized");
      return { vp8: false, h264: false, vp9: false, av1: false };
    }
    return this.webrtcService.getCodecCapabilities();
  }

  /**
   * Gets the preferred codec based on forced flags and capabilities
   * @returns The preferred codec or null if none available
   */
  private getPreferredCodec(): any {
    return this.webrtcService.getPreferredCodec("video");
  }

  /**
   * Sets preferred codec for video production
   * @param codec Codec type ('vp8', 'h264', 'vp9', 'av1')
   */
  public setPreferredCodec(codec: "vp8" | "h264" | "vp9" | "av1"): void {
    this.logger.info("Setting preferred codec", { codec });

    // Reset all force flags
    this._forceVP8 = false;
    this._forceH264 = false;
    this._forceVP9 = false;
    this._forceAV1 = false;

    // Set the requested codec
    switch (codec) {
      case "vp8":
        this._forceVP8 = true;
        break;
      case "h264":
        this._forceH264 = true;
        break;
      case "vp9":
        this._forceVP9 = true;
        break;
      case "av1":
        this._forceAV1 = true;
        break;
    }

    // Emit event for UI updates
    this.emit("codecPreferenceChanged", codec);
  }
  // Display name methods
  public changeDisplayName(displayName: string): void {
    console.log("changeDisplayName()", displayName);

    if (!displayName) {
      return;
    }

    if (displayName === this._displayName) {
      return;
    }

    try {
      // this.webrtcService.protooRequest("changeDisplayName", { displayName });
      this.webrtcService.changeDisplayNameOnServer(displayName);

      this._displayName = displayName;

      // Update store
      if (this._store) {
        this._store.dispatch(
          meActions.setDisplayName({ displayName, displayNameSet: true })
        );
      }

      // Emit event
      this.emit("displayNameChanged", displayName);
    } catch (error) {
      console.error("changeDisplayName() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not change display name",
      });
    }
  }

  // Media methods
  private async enableMic(): Promise<void> {
    console.log("enableMic()");

    if (this._micProducer) {
      return;
    }

    if (!this._produce) {
      return;
    }

    try {
      // Get audio track
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];

      if (!track) {
        throw new Error("No audio track available");
      }

      // Produce audio
      const producer = await this.webrtcService.produceAudio(track);

      if (!producer) {
        throw new Error("Failed to produce audio");
      }

      this._micProducer = producer;

      // Save stream
      if (!this._localMediaStream) {
        this._localMediaStream = new MediaStream();
      }
      this._localMediaStream.addTrack(track);

      // Emit event
      this.emit("micProducer", producer);
    } catch (error) {
      console.error("enableMic() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not enable microphone",
      });

      throw error;
    }
  }

  public async disableMic(): Promise<void> {
    console.log("disableMic()");

    if (!this._micProducer) {
      return;
    }

    // Close producer
    this.webrtcService.closeProducer("audio");

    // Remove track from local stream
    if (this._localMediaStream && this._micProducer.track) {
      this._localMediaStream.removeTrack(this._micProducer.track);
    }

    this._micProducer = null;

    // Update store
    if (this._store) {
      this._store.dispatch(producersActions.removeProducer({ kind: "audio" }));
    }

    // Emit event
    this.emit("micProducerClosed");
  }

  public async muteMic(): Promise<void> {
    console.log("muteMic()");

    if (!this._micProducer) {
      return;
    }

    await this.webrtcService.pauseProducer("audio");

    // Update store
    if (this._store) {
      this._store.dispatch(
        producersActions.setProducerPaused({ kind: "audio", paused: true })
      );

      this._store.dispatch(meActions.setAudioMuted(true));
    }

    // Emit event
    this.emit("micPaused");
  }

  public async unmuteMic(): Promise<void> {
    console.log("unmuteMic()");

    if (!this._micProducer) {
      return;
    }

    await this.webrtcService.resumeProducer("audio");

    // Update store
    if (this._store) {
      this._store.dispatch(
        producersActions.setProducerPaused({ kind: "audio", paused: false })
      );

      this._store.dispatch(meActions.setAudioMuted(false));
    }

    // Emit event
    this.emit("micResumed");
  }

  public async enableWebcam(): Promise<void> {
    this.logger.info("enableWebcam()");

    if (this._webcamProducer) {
      return;
    }

    if (!this._produce) {
      return;
    }

    if (this._shareProducer) {
      await this.disableShare();
    }

    if (this._webcamInProgress) {
      return;
    }

    this._webcamInProgress = true;

    try {
      // Get video track
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      const track = stream.getVideoTracks()[0];
      // Produce video with codec preference
      const codec = this.getPreferredCodec();
      if (codec) {
        this.logger.info("Using preferred codec", {
          codecType: codec.mimeType,
        });
      }

      if (!track) {
        throw new Error("No video track available");
      }

      // Produce video
      const producer = await this.webrtcService.produceVideo(
        track,
        "front",
        codec
      );

      if (!producer) {
        throw new Error("Failed to produce video");
      }

      this._webcamProducer = producer;

      // Save stream
      if (!this._localMediaStream) {
        this._localMediaStream = new MediaStream();
      }
      this._localMediaStream.addTrack(track);

      // Emit event
      this.emit("webcamProducer", producer);
    } catch (error) {
      console.error("enableWebcam() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not enable webcam",
      });

      throw error;
    } finally {
      this._webcamInProgress = false;
    }
  }

  public async disableWebcam(): Promise<void> {
    console.log("disableWebcam()");

    if (!this._webcamProducer) {
      return;
    }

    // Close producer
    this.webrtcService.closeProducer("video");

    // Remove track from local stream
    if (this._localMediaStream && this._webcamProducer.track) {
      this._localMediaStream.removeTrack(this._webcamProducer.track);
    }

    this._webcamProducer = null;

    // Update store
    if (this._store) {
      this._store.dispatch(producersActions.removeProducer({ kind: "video" }));
    }

    // Emit event
    this.emit("webcamProducerClosed");
  }

  public async changeWebcam(): Promise<void> {
    console.log("changeWebcam()");

    if (!this._webcamProducer) {
      return;
    }

    if (this._webcamInProgress) {
      return;
    }

    this._webcamInProgress = true;

    try {
      // Get device IDs
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices.length < 2) {
        throw new Error("Cannot change webcam - only one camera available");
      }

      // Find current device ID
      const currentDeviceId = this._webcamProducer.deviceLabel;

      // Find next device ID
      const currentDeviceIdx = videoDevices.findIndex(
        (device) => device.label === currentDeviceId
      );
      const nextDeviceIdx = (currentDeviceIdx + 1) % videoDevices.length;
      const nextDeviceId = videoDevices[nextDeviceIdx].deviceId;

      // Stop current track
      if (this._webcamProducer.track) {
        this._webcamProducer.track.stop();
      }

      // Get new video track
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      const track = stream.getVideoTracks()[0];

      if (!track) {
        throw new Error("No video track available");
      }

      // Replace track
      await this.webrtcService.closeProducer("video");

      // Remove old track from local stream
      if (this._localMediaStream) {
        const oldTracks = this._localMediaStream.getVideoTracks();
        for (const oldTrack of oldTracks) {
          this._localMediaStream.removeTrack(oldTrack);
        }
      }

      // Produce new video track
      const producer = await this.webrtcService.produceVideo(track, "front");

      if (!producer) {
        throw new Error("Failed to produce video with new camera");
      }

      this._webcamProducer = producer;

      // Update store
      if (this._store) {
        this._store.dispatch(producersActions.addProducer(producer));
      }

      // Add new track to local stream
      if (this._localMediaStream) {
        this._localMediaStream.addTrack(track);
      }

      // Emit event
      this.emit("webcamChanged", producer);
    } catch (error) {
      console.error("changeWebcam() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not change webcam",
      });

      throw error;
    } finally {
      this._webcamInProgress = false;
    }
  }

  public async enableShare(): Promise<void> {
    console.log("enableShare()");

    if (this._shareProducer) {
      return;
    }

    if (!this._produce) {
      return;
    }

    if (this._webcamProducer) {
      await this.disableWebcam();
    }

    if (this._shareInProgress) {
      return;
    }

    this._shareInProgress = true;

    try {
      // Get display media
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];

      if (!track) {
        throw new Error("No video track available for sharing");
      }

      // Listen for track end (user stops sharing)
      track.addEventListener("ended", () => {
        this.disableShare().catch((error) =>
          console.error("disableShare() failed", error)
        );
      });

      // Produce video
      const producer = await this.webrtcService.produceVideo(track, "share");

      if (!producer) {
        throw new Error("Failed to produce screen share video");
      }

      this._shareProducer = producer;

      // Save stream
      if (!this._localMediaStream) {
        this._localMediaStream = new MediaStream();
      }
      this._localMediaStream.addTrack(track);

      // Emit event
      this.emit("shareProducer", producer);
    } catch (error) {
      console.error("enableShare() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not enable screen sharing",
      });

      throw error;
    } finally {
      this._shareInProgress = false;
    }
  }

  public async disableShare(): Promise<void> {
    console.log("disableShare()");

    if (!this._shareProducer) {
      return;
    }

    // Close producer
    this.webrtcService.closeProducer("video");

    // Remove track from local stream
    if (this._localMediaStream && this._shareProducer.track) {
      this._localMediaStream.removeTrack(this._shareProducer.track);
    }

    // Stop track
    if (this._shareProducer.track) {
      this._shareProducer.track.stop();
    }

    this._shareProducer = null;

    // Update store
    if (this._store) {
      this._store.dispatch(producersActions.removeProducer({ kind: "video" }));
    }

    // Emit event
    this.emit("shareProducerClosed");

    // Automatically re-enable webcam
    await this.enableWebcam();
  }

  public async enableAudioOnly(): Promise<void> {
    console.log("enableAudioOnly()");

    if (this._audioOnly) {
      return;
    }

    this._audioOnly = true;
    this._audioOnlyInProgress = true;

    try {
      // Close webcam/share producer
      if (this._webcamProducer) {
        await this.disableWebcam();
      } else if (this._shareProducer) {
        await this.disableShare();
      }

      // Pause all video consumers
      for (const consumerId of await this.webrtcService.getConsumerIds()) {
        const consumer = await this.webrtcService.getConsumer(consumerId);

        if (consumer && consumer.track && consumer.track.kind === "video") {
          await this.webrtcService.pauseConsumer(consumerId);
        }
      }

      // Update store
      if (this._store) {
        this._store.dispatch(meActions.setAudioOnly(true));

        this._store.dispatch(meActions.setAudioOnlyInProgress(false));
      }

      // Emit event
      this.emit("audioOnlyEnabled");
    } catch (error) {
      console.error("enableAudioOnly() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not enable audio only mode",
      });

      throw error;
    } finally {
      this._audioOnlyInProgress = false;
    }
  }

  public async disableAudioOnly(): Promise<void> {
    console.log("disableAudioOnly()");

    if (!this._audioOnly) {
      return;
    }

    this._audioOnly = false;
    this._audioOnlyInProgress = true;

    try {
      // Resume all video consumers
      for (const consumerId of await this.webrtcService.getConsumerIds()) {
        const consumer = await this.webrtcService.getConsumer(consumerId);

        if (consumer && consumer.track && consumer.track.kind === "video") {
          await this.webrtcService.resumeConsumer(consumerId);
        }
      }

      // Re-enable webcam if it was enabled
      const webcamEnabled = true; // Could be from cookies or user preferences
      if (webcamEnabled) {
        await this.enableWebcam();
      }

      // Update store
      if (this._store) {
        this._store.dispatch(meActions.setAudioOnly(false));

        this._store.dispatch(meActions.setAudioOnlyInProgress(false));
      }

      // Emit event
      this.emit("audioOnlyDisabled");
    } catch (error) {
      console.error("disableAudioOnly() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not disable audio only mode",
      });

      throw error;
    } finally {
      this._audioOnlyInProgress = false;
    }
  }

  public async muteAudio(): Promise<void> {
    console.log("muteAudio()");

    // Mute all audio consumers
    for (const consumerId of await this.webrtcService.getConsumerIds()) {
      const consumer = await this.webrtcService.getConsumer(consumerId);

      if (consumer && consumer.track && consumer.track.kind === "audio") {
        await this.webrtcService.pauseConsumer(consumerId);
      }
    }

    // Update store
    if (this._store) {
      this._store.dispatch(meActions.setAudioMuted(true));
    }

    // Emit event
    this.emit("audioMuted");
  }

  public async unmuteAudio(): Promise<void> {
    console.log("unmuteAudio()");

    // Unmute all audio consumers
    for (const consumerId of await this.webrtcService.getConsumerIds()) {
      const consumer = await this.webrtcService.getConsumer(consumerId);

      if (consumer && consumer.track && consumer.track.kind === "audio") {
        await this.webrtcService.resumeConsumer(consumerId);
      }
    }

    // Update store
    if (this._store) {
      this._store.dispatch(meActions.setAudioMuted(false));
    }

    // Emit event
    this.emit("audioUnmuted");
  }

  // ICE restart
  public async restartIce(): Promise<void> {
    console.log("restartIce()");

    if (this._restartIceInProgress) {
      return;
    }

    this._restartIceInProgress = true;

    // Update store
    if (this._store) {
      this._store.dispatch(meActions.setRestartIceInProgress(true));
    }

    try {
      await this.webrtcService.restartIce();

      // Emit event
      this.emit("iceRestarted");
    } catch (error) {
      console.error("restartIce() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "ICE restart failed",
      });

      throw error;
    } finally {
      this._restartIceInProgress = false;

      // Update store
      if (this._store) {
        this._store.dispatch(meActions.setRestartIceInProgress(false));
      }
    }
  }

  // Chat methods
  public async enableChatDataProducer(): Promise<void> {
    console.log("enableChatDataProducer()");

    if (this._chatDataProducer) {
      return;
    }

    try {
      const dataProducer = await this.webrtcService.createDataProducer("chat");

      if (!dataProducer) {
        throw new Error("Failed to create chat data producer");
      }

      this._chatDataProducer = dataProducer;

      // Update store
      if (this._store) {
        this._store.dispatch(
          dataProducersActions.addDataProducer(dataProducer)
        );
      }

      // Emit event
      this.emit("chatDataProducer", dataProducer);
    } catch (error) {
      console.error("enableChatDataProducer() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not enable chat",
      });

      throw error;
    }
  }

  public async enableBotDataProducer(): Promise<void> {
    console.log("enableBotDataProducer()");

    if (this._botDataProducer) {
      return;
    }

    try {
      const dataProducer = await this.webrtcService.createDataProducer("bot");

      if (!dataProducer) {
        throw new Error("Failed to create bot data producer");
      }

      this._botDataProducer = dataProducer;

      // Update store
      if (this._store) {
        this._store.dispatch(
          dataProducersActions.addDataProducer(dataProducer)
        );
      }

      // Emit event
      this.emit("botDataProducer", dataProducer);
    } catch (error) {
      console.error("enableBotDataProducer() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not enable bot",
      });

      throw error;
    }
  }

  public async sendChatMessage(text: string): Promise<void> {
    console.log("sendChatMessage()", text);

    if (!this._chatDataProducer) {
      await this.enableChatDataProducer();
    }

    try {
      this.webrtcService.sendData("chat", {
        type: "chat-message",
        timestamp: Date.now(),
        peerId: this._peerId,
        displayName: this._displayName,
        text,
      });
    } catch (error) {
      console.error("sendChatMessage() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not send chat message",
      });

      throw error;
    }
  }

  public async sendBotMessage(text: string): Promise<void> {
    console.log("sendBotMessage()", text);

    if (!this._botDataProducer) {
      await this.enableBotDataProducer();
    }

    try {
      this.webrtcService.sendData("bot", {
        type: "bot-message",
        timestamp: Date.now(),
        peerId: this._peerId,
        displayName: this._displayName,
        text,
      });
    } catch (error) {
      console.error("sendBotMessage() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not send bot message",
      });

      throw error;
    }
  }

  // Consumer methods
  public async setConsumerPriority(
    consumerId: string,
    priority: number
  ): Promise<void> {
    console.log("setConsumerPriority()", consumerId, priority);

    await this.webrtcService.setConsumerPriority(consumerId, priority);
  }

  public async setConsumerPreferredLayers(
    consumerId: string,
    spatialLayer: number,
    temporalLayer: number
  ): Promise<void> {
    console.log(
      "setConsumerPreferredLayers()",
      consumerId,
      spatialLayer,
      temporalLayer
    );

    await this.webrtcService.setConsumerPreferredLayers(
      consumerId,
      spatialLayer,
      temporalLayer
    );
  }

  public async requestConsumerKeyFrame(consumerId: string): Promise<void> {
    console.log("requestConsumerKeyFrame()", consumerId);

    await this.webrtcService.requestConsumerKeyFrame(consumerId);
  }

  public async pauseConsumer(consumerId: string): Promise<void> {
    console.log("pauseConsumer()", consumerId);

    await this.webrtcService.pauseConsumer(consumerId);

    // Emit event
    this.emit("consumerPaused", consumerId);
  }

  public async resumeConsumer(consumerId: string): Promise<void> {
    console.log("resumeConsumer()", consumerId);

    await this.webrtcService.resumeConsumer(consumerId);

    // Emit event
    this.emit("consumerResumed", consumerId);
  }

  // Stats methods
  public async getTransportStats(type: "send" | "recv"): Promise<any> {
    return this.webrtcService.getTransportStats(type);
  }

  public async getAudioStats(): Promise<any> {
    if (!this._micProducer) {
      return null;
    }

    return this.webrtcService.getProducerStats(this._micProducer.id);
  }

  public async getVideoStats(): Promise<any> {
    if (!this._webcamProducer && !this._shareProducer) {
      return null;
    }

    const producerId = this._webcamProducer
      ? this._webcamProducer.id
      : this._shareProducer!.id;

    return this.webrtcService.getProducerStats(producerId);
  }

  public async getConsumerStats(consumerId: string): Promise<any> {
    return this.webrtcService.getConsumerStats(consumerId);
  }

  // Utility methods
  private cleanupMedia(): void {
    // Close producers
    if (this._micProducer) {
      this._micProducer.track?.stop();
      this._micProducer = null;
    }

    if (this._webcamProducer) {
      this._webcamProducer.track?.stop();
      this._webcamProducer = null;
    }

    if (this._shareProducer) {
      this._shareProducer.track?.stop();
      this._shareProducer = null;
    }

    // Clean up local stream
    if (this._localMediaStream) {
      this._localMediaStream.getTracks().forEach((track) => track.stop());
      this._localMediaStream = null;
    }

    // Reset flags
    this._webcamInProgress = false;
    this._shareInProgress = false;
    this._audioOnly = false;
    this._audioOnlyInProgress = false;
    this._restartIceInProgress = false;
  }

  private configureSimulcastEncodings(numStreams: number): any[] {
    if (numStreams === 1) {
      return [{ maxBitrate: 5000000, scaleResolutionDownBy: 1 }];
    } else if (numStreams === 2) {
      return [
        { maxBitrate: 1000000, scaleResolutionDownBy: 2 },
        { maxBitrate: 5000000, scaleResolutionDownBy: 1 },
      ];
    } else {
      return [
        { maxBitrate: 500000, scaleResolutionDownBy: 4 },
        { maxBitrate: 1000000, scaleResolutionDownBy: 2 },
        { maxBitrate: 5000000, scaleResolutionDownBy: 1 },
      ];
    }
  }

  private setupServiceEventListeners(): void {
    // Add consumer score tracking
    this.setupConsumerScoreTracking();
    // WebRTC service callbacks
    this.webrtcService.onConnect(() => {
      console.log("WebRTC service connected");
      this.emit("connected");
    });

    this.webrtcService.onDisconnect(() => {
      console.log("WebRTC service disconnected");
      this.emit("disconnected");

      // Close client
      this.close();
    });

    this.webrtcService.onProducer((producer) => {
      console.log("WebRTC service producer", producer);

      // Update store
      if (this._store) {
        this._store.dispatch(producersActions.addProducer(producer));
      }

      // Emit event
      this.emit("producer", producer);
    });

    this.webrtcService.onConsumer((consumer) => {
      console.log("WebRTC service consumer", consumer);

      // Update store
      if (this._store) {
        this._store.dispatch(consumersActions.addConsumer(consumer));
      }

      // Emit event
      this.emit("consumer", consumer);
    });

    this.webrtcService.onDataProducer((dataProducer) => {
      console.log("WebRTC service data producer", dataProducer);

      // Update store
      if (this._store) {
        this._store.dispatch(
          dataProducersActions.addDataProducer(dataProducer)
        );
      }

      // Emit event
      this.emit("dataProducer", dataProducer);
    });

    this.webrtcService.onDataConsumer((dataConsumer) => {
      console.log("WebRTC service data consumer", dataConsumer);

      // Update store
      if (this._store) {
        this._store.dispatch(
          dataConsumersActions.addDataConsumer(dataConsumer)
        );
      }

      // Emit event
      this.emit("dataConsumer", dataConsumer);
    });

    this.webrtcService.onNotification((notification) => {
      console.log("WebRTC service notification", notification);

      // Handle active speaker
      if (notification.type === "activeSpeaker") {
        // Update store
        if (this._store) {
          this._store.dispatch(
            roomActions.setRoomActiveSpeaker(notification.peerId)
          );
        }

        // Emit event
        this.emit("activeSpeaker", notification.peerId);
      }

      // Handle mediasoup versions
      if (notification.type === "mediasoup-versions") {
        if (this._store && notification.payload) {
          this.logger.info(
            "Dispatching mediasoup versions to store",
            notification.payload
          );
          this._store.dispatch(
            roomActions.setRoomMediasoupInfo({
              mediasoupVersion: notification.payload.version,
              mediasoupClientVersion: notification.payload.clientVersion,
              mediasoupClientHandler: notification.payload.clientHandler,
            })
          );
        }
      }

      // Handle data messages
      if (notification.type === "data") {
        // Emit event
        this.emit("message", notification.data);
      }

      // Emit generic notification event
      this.emit("notification", notification);
    });
  }
  /**
   * Sets the maximum spatial layer for simulcast video
   * @param spatialLayer The spatial layer to set (0, 1, 2, etc.)
   */
  public async setMaxSendingSpatialLayer(spatialLayer: number): Promise<void> {
    console.log("setMaxSendingSpatialLayer()", spatialLayer);

    if (spatialLayer < 0) {
      console.error("Invalid spatial layer value:", spatialLayer);
      return;
    }

    try {
      // Find the video producer
      const videoProducer = this._webcamProducer || this._shareProducer;
      if (!videoProducer) {
        console.warn(
          "Cannot set max sending spatial layer: No video producer found"
        );
        return;
      }

      // Call the WebRTCService
      await this.webrtcService.setMaxSpatialLayer(
        videoProducer.id,
        spatialLayer
      );

      // Update the local state
      const maxSpatialLayer = spatialLayer;

      // Emit event
      this.emit("maxSendingSpatialLayerChanged", spatialLayer);
    } catch (error) {
      console.error("setMaxSendingSpatialLayer() failed", error);

      // Emit notification
      this.emit("notification", {
        type: "error",
        text: "Could not set video quality level",
      });

      throw error;
    }
  }
  /**
   * Resets network throttling settings
   * @param options Reset options
   * @param options.secret Secret key for throttling access
   * @param options.silent Whether to suppress notifications
   */
  public async resetNetworkThrottle(
    options: { secret: string; silent?: boolean } = { secret: "" }
  ): Promise<void> {
    console.log("resetNetworkThrottle()");

    try {
      // Call the WebRTCService method
      await this.webrtcService.resetNetworkThrottle(options);

      // Don't emit notification if silent mode is requested
      if (!options.silent) {
        this.emit("notification", {
          type: "info",
          text: "Network throttling has been reset",
        });
      }
    } catch (error) {
      console.error("resetNetworkThrottle() failed", error);

      // Don't emit notification if silent mode is requested
      if (!options.silent) {
        this.emit("notification", {
          type: "error",
          text: "Could not reset network throttling",
        });
      }
    }
  }
  // Add these methods to the RoomClient.ts class

  /**
   * Gets remote statistics for the sending transport
   * @returns Promise with transport statistics
   * @throws Error if send transport doesn't exist
   */
  public async getSendTransportRemoteStats(): Promise<any> {
    this.log("debug", "getSendTransportRemoteStats()");

    if (!this.webrtcService) {
      this.log("error", "WebRTC service not initialized");
      return null;
    }

    try {
      const stats = await this.webrtcService.getTransportStats("send");
      this.log("debug", "Successfully retrieved send transport remote stats");
      return stats;
    } catch (error) {
      this.log("error", "Failed to get send transport remote stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets remote statistics for the receiving transport
   * @returns Promise with transport statistics
   * @throws Error if recv transport doesn't exist
   */
  public async getRecvTransportRemoteStats(): Promise<any> {
    this.log("debug", "getRecvTransportRemoteStats()");

    if (!this.webrtcService) {
      this.log("error", "WebRTC service not initialized");
      return null;
    }

    try {
      const stats = await this.webrtcService.getTransportStats("recv");
      this.log("debug", "Successfully retrieved recv transport remote stats");
      return stats;
    } catch (error) {
      this.log("error", "Failed to get recv transport remote stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets local statistics for the sending transport
   * @returns Promise with transport statistics
   * @throws Error if send transport doesn't exist
   */
  public async getSendTransportLocalStats(): Promise<any> {
    this.log("debug", "getSendTransportLocalStats()");

    if (!this.webrtcService) {
      this.log("error", "WebRTC service not initialized");
      return null;
    }

    try {
      const stats = await this.webrtcService.getTransportLocalStats("send");
      this.log("debug", "Successfully retrieved send transport local stats");
      return stats;
    } catch (error) {
      this.log("error", "Failed to get send transport local stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets local statistics for the receiving transport
   * @returns Promise with transport statistics
   * @throws Error if recv transport doesn't exist
   */
  public async getRecvTransportLocalStats(): Promise<any> {
    this.log("debug", "getRecvTransportLocalStats()");

    if (!this.webrtcService) {
      this.log("error", "WebRTC service not initialized");
      return null;
    }

    try {
      const stats = await this.webrtcService.getTransportLocalStats("recv");
      this.log("debug", "Successfully retrieved recv transport local stats");
      return stats;
    } catch (error) {
      this.log("error", "Failed to get recv transport local stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets remote statistics for the audio producer (microphone)
   * @returns Promise with audio producer statistics from server
   * @throws Error if no audio producer exists
   */
  public async getAudioRemoteStats(): Promise<any> {
    this.logger.debug("getAudioRemoteStats()");

    if (!this._micProducer) {
      this.logger.warn("No audio producer available");
      return null;
    }

    try {
      const stats = await this.webrtcService.getProducerStats(
        this._micProducer.id
      );
      this.logger.debug("Successfully retrieved audio producer remote stats");
      return stats;
    } catch (error) {
      this.logger.error("Failed to get audio producer remote stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets remote statistics for the video producer (webcam or screen share)
   * @returns Promise with video producer statistics from server
   * @throws Error if no video producer exists
   */
  public async getVideoRemoteStats(): Promise<any> {
    this.logger.debug("getVideoRemoteStats()");

    const videoProducer = this._webcamProducer || this._shareProducer;

    if (!videoProducer) {
      this.logger.warn("No video producer available");
      return null;
    }

    try {
      const stats = await this.webrtcService.getProducerStats(videoProducer.id);
      this.logger.debug("Successfully retrieved video producer remote stats", {
        producerType: this._webcamProducer ? "webcam" : "share",
      });
      return stats;
    } catch (error) {
      this.logger.error("Failed to get video producer remote stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets local statistics for the audio producer (microphone)
   * @returns Promise with audio producer statistics from local peer connection
   * @throws Error if no audio producer exists
   */
  public async getAudioLocalStats(): Promise<any> {
    this.logger.debug("getAudioLocalStats()");

    if (!this._micProducer) {
      this.logger.warn("No audio producer available");
      return null;
    }

    try {
      const stats = await this.webrtcService.getProducerStats(
        this._micProducer.id
      );
      this.logger.debug("Successfully retrieved audio producer local stats");
      return stats;
    } catch (error) {
      this.logger.error("Failed to get audio producer local stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets local statistics for the video producer (webcam or screen share)
   * @returns Promise with video producer statistics from local peer connection
   * @throws Error if no video producer exists
   */
  public async getVideoLocalStats(): Promise<any> {
    this.logger.debug("getVideoLocalStats()");

    const videoProducer = this._webcamProducer || this._shareProducer;

    if (!videoProducer) {
      this.logger.warn("No video producer available");
      return null;
    }

    if (!this.webrtcService) {
      this.logger.error("WebRTC service not initialized");
      return null;
    }

    try {
      const stats = await this.webrtcService.getProducerStats(videoProducer.id);
      this.logger.debug("Successfully retrieved video producer local stats", {
        producerType: this._webcamProducer ? "webcam" : "share",
      });
      return stats;
    } catch (error) {
      this.logger.error("Failed to get video producer local stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets remote statistics for a specific consumer
   * @param consumerId The consumer ID to get stats for
   * @returns Promise with consumer statistics from server
   * @throws Error if consumer not found
   */
  public async getConsumerRemoteStats(consumerId: string): Promise<any> {
    this.logger.debug("getConsumerRemoteStats()", { consumerId });

    if (!consumerId) {
      this.logger.error("Missing consumer ID");
      return null;
    }

    try {
      const stats = await this.webrtcService.getConsumerStats(consumerId);
      this.logger.debug("Successfully retrieved consumer remote stats", {
        consumerId,
      });
      return stats;
    } catch (error) {
      this.logger.error("Failed to get consumer remote stats", {
        consumerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets local statistics for a specific consumer
   * @param consumerId The consumer ID to get stats for
   * @returns Promise with consumer statistics from local peer connection
   * @throws Error if consumer not found
   */
  public async getConsumerLocalStats(consumerId: string): Promise<any> {
    this.logger.debug("getConsumerLocalStats()", { consumerId });

    if (!consumerId) {
      this.logger.error("Missing consumer ID");
      return null;
    }

    try {
      const stats = await this.webrtcService.getConsumerLocalStats(consumerId);
      this.logger.debug("Successfully retrieved consumer local stats", {
        consumerId,
      });
      return stats;
    } catch (error) {
      this.logger.error("Failed to get consumer local stats", {
        consumerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Sets up consumer score tracking
   * Called during service event listener setup
   */
  private setupConsumerScoreTracking(): void {
    this.webrtcService.onNotification((notification) => {
      if (notification.method === "consumerScore") {
        const { consumerId, score } = notification.data;

        this.logger.debug("Consumer score update", { consumerId, score });

        // Update store with consumer score
        if (this._store) {
          this._store.dispatch(
            consumersActions.setConsumerScore({ id: consumerId, score })
          );
        }

        // Emit consumer score event
        this.emit("consumerScore", { consumerId, score });
      }
    });
  }

  /**
   * Gets remote statistics for chat data producer
   * @returns Promise with chat data producer statistics from server
   */
  public async getChatDataProducerRemoteStats(): Promise<any> {
    this.logger.debug("getChatDataProducerRemoteStats()");

    if (!this._chatDataProducer) {
      this.logger.warn("No chat data producer available");
      return null;
    }

    try {
      const stats = await this.webrtcService.getDataProducerStats(
        this._chatDataProducer.id
      );
      this.logger.debug(
        "Successfully retrieved chat data producer remote stats"
      );
      return stats;
    } catch (error) {
      this.logger.error("Failed to get chat data producer remote stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets remote statistics for bot data producer
   * @returns Promise with bot data producer statistics from server
   */
  public async getBotDataProducerRemoteStats(): Promise<any> {
    this.logger.debug("getBotDataProducerRemoteStats()");

    if (!this._botDataProducer) {
      this.logger.warn("No bot data producer available");
      return null;
    }

    try {
      const stats = await this.webrtcService.getDataProducerStats(
        this._botDataProducer.id
      );
      this.logger.debug(
        "Successfully retrieved bot data producer remote stats"
      );
      return stats;
    } catch (error) {
      this.logger.error("Failed to get bot data producer remote stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  /**
   * Gets remote statistics for a specific data consumer
   * @param dataConsumerId The data consumer ID to get stats for
   * @returns Promise with data consumer statistics from server
   */
  public async getDataConsumerRemoteStats(
    dataConsumerId: string
  ): Promise<any> {
    this.logger.debug("getDataConsumerRemoteStats()", { dataConsumerId });

    if (!dataConsumerId) {
      this.logger.error("Missing data consumer ID");
      return null;
    }

    try {
      const stats = await this.webrtcService.getDataConsumerStats(
        dataConsumerId
      );
      this.logger.debug("Successfully retrieved data consumer remote stats", {
        dataConsumerId,
      });
      return stats;
    } catch (error) {
      this.logger.error("Failed to get data consumer remote stats", {
        dataConsumerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Helper method for logging
   * @param level Log level
   * @param message Log message
   * @param data Optional data to log
   */
  // Replace the old log method with this one
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: any
  ): void {
    switch (level) {
      case "debug":
        this.logger.debug(message, data);
        break;
      case "info":
        this.logger.info(message, data);
        break;
      case "warn":
        this.logger.warn(message, data);
        break;
      case "error":
        this.logger.error(message, data);
        break;
    }
  }
}
