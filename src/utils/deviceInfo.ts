// utils/deviceInfo.ts
import { Device } from "../types";
import UAParser from "ua-parser-js";

export default function (): Device {
  const parser = new UAParser(window.navigator.userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();

  let flag;

  if (
    browser.name?.toLowerCase().includes("chrome") ||
    browser.name?.toLowerCase().includes("chromium")
  ) {
    flag = "chrome";
  } else if (browser.name?.toLowerCase().includes("firefox")) {
    flag = "firefox";
  } else if (browser.name?.toLowerCase().includes("safari")) {
    flag = "safari";
  } else if (browser.name?.toLowerCase().includes("edge")) {
    flag = "edge";
  } else if (browser.name?.toLowerCase().includes("opera")) {
    flag = "opera";
  } else {
    flag = "unknown";
  }

  return {
    flag,
    name: browser.name || "unknown",
    version: browser.version || "unknown",
    os: os.name,
  };
}
