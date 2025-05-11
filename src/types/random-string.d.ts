// src/types/random-string.d.ts
// Type definitions for random-string

declare module "random-string" {
  interface RandomStringOptions {
    length?: number;
    numeric?: boolean;
    letters?: boolean;
    special?: boolean;
    exclude?: string[];
  }

  function randomString(options?: RandomStringOptions): string;
  export = randomString;
}
