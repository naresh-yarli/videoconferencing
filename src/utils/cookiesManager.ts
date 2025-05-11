// src/utils/cookiesManager.ts
import Cookies from "js-cookie";

const USER_COOKIE = "mediasoup_user";
const DEVICES_COOKIE = "mediasoup_devices";

export interface UserData {
  displayName?: string;
}

export interface DevicesData {
  webcamEnabled?: boolean;
  micEnabled?: boolean;
}

export function getUser(): UserData | null {
  try {
    const data = Cookies.get(USER_COOKIE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error parsing user cookie", error);
    return null;
  }
}

export function setUser(userData: UserData): void {
  Cookies.set(USER_COOKIE, JSON.stringify(userData), { expires: 365 });
}

export function getDevices(): DevicesData | null {
  try {
    const data = Cookies.get(DEVICES_COOKIE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error parsing devices cookie", error);
    return null;
  }
}

export function setDevices(devicesData: DevicesData): void {
  Cookies.set(DEVICES_COOKIE, JSON.stringify(devicesData), { expires: 365 });
}

export function clearCookies(): void {
  Cookies.remove(USER_COOKIE);
  Cookies.remove(DEVICES_COOKIE);
}
