// src/services/WebRTCLogger.ts
import Logger from "./Logger";

export class WebRTCLogger extends Logger {
  constructor(component: string) {
    super(`WebRTC:${component}`);
  }

  // Log RTP parameters
  rtpParameters(action: string, params: any): void {
    this.debug(`${action} RTP parameters:`, {
      codecs: params.codecs?.map((c: any) => c.mimeType),
      headerExtensions: params.headerExtensions?.map((h: any) => h.uri),
      encodings: params.encodings,
    });
  }

  // Log transport state
  transportState(
    transportId: string,
    state: string,
    direction: "send" | "recv"
  ): void {
    this.info(`Transport ${direction} state changed:`, {
      transportId,
      state,
    });
  }

  // Log producer/consumer creation
  producerCreated(
    kind: "audio" | "video",
    producerId: string,
    track: MediaStreamTrack
  ): void {
    this.info(`${kind} producer created:`, {
      producerId,
      trackId: track.id,
      trackLabel: track.label,
      trackEnabled: track.enabled,
      trackMuted: track.muted,
    });
  }

  consumerCreated(
    kind: "audio" | "video",
    consumerId: string,
    producerId: string
  ): void {
    this.info(`${kind} consumer created:`, {
      consumerId,
      producerId,
    });
  }

  // Log statistics
  stats(type: string, stats: any): void {
    this.debug(`${type} stats:`, stats);
  }

  // Log negotiation events
  negotiation(event: string, data?: any): void {
    this.webrtc(`Negotiation event: ${event}`, data);
  }

  // Log ICE events
  ice(event: string, data?: any): void {
    this.debug(`ICE event: ${event}`, data);
  }

  // Log data channel events
  dataChannel(event: string, data?: any): void {
    this.debug(`Data channel event: ${event}`, data);
  }
}
