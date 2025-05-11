// src/types/url-parse.d.ts
// Type definitions for url-parse

declare module "url-parse" {
  class Url {
    constructor(url: string, parseQueryString?: boolean);
    protocol: string;
    slashes: boolean;
    auth: string;
    username: string;
    password: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    query: any;
    hash: string;
    href: string;
    origin: string;
    set(part: string, value: string): Url;
    toString(): string;
  }
  export = Url;
}
