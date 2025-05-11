// src/types/pokemon.d.ts
// Type definitions for pokemon

declare module "pokemon" {
  export function random(language?: string): string;
  export function getName(id: number, language?: string): string;
  export function getId(name: string, language?: string): number;
  export function all(language?: string): string[];
}
