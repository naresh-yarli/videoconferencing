// src/types/hark.d.ts
// Type definitions for hark

declare module "hark" {
  interface HarkOptions {
    interval?: number;
    threshold?: number;
    play?: boolean;
    history?: number;
  }

  interface Harker {
    stop(): void;
    on(event: "speaking", listener: () => void): void;
    on(event: "stopped_speaking", listener: () => void): void;
    on(
      event: "volume_change",
      listener: (dBs: number, threshold: number) => void
    ): void;
  }

  function hark(stream: MediaStream, options?: HarkOptions): Harker;
  export = hark;
}
