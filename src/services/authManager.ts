// src/utils/authManager.ts
/**
 * Authentication manager - handles secure token exchange
 * Never stores API keys in client
 */
import Logger from "@/services/Logger";

const logger = new Logger("AuthManager");

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

class AuthManager {
  private tokens: AuthTokens | null = null;

  async authenticate(roomId: string): Promise<AuthTokens> {
    try {
      // Server validates request and returns temporary tokens
      const response = await fetch("/api/auth/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId }),
      });

      if (!response.ok) throw new Error("Authentication failed");

      const tokens = await response.json();
      this.tokens = tokens;

      // Set up auto-refresh before expiry
      this.scheduleTokenRefresh(tokens);

      return tokens;
    } catch (error) {
      logger.error("Authentication failed", error);
      throw error;
    }
  }

  private scheduleTokenRefresh(tokens: AuthTokens): void {
    const refreshTime = tokens.expiresAt - Date.now() - 60000; // 1 minute before expiry

    setTimeout(async () => {
      try {
        await this.refreshTokens();
      } catch (error) {
        logger.error("Token refresh failed", error);
      }
    }, refreshTime);
  }

  async refreshTokens(): Promise<AuthTokens> {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) throw new Error("Token refresh failed");

    const tokens = await response.json();
    this.tokens = tokens;
    this.scheduleTokenRefresh(tokens);
    return tokens;
  }

  getAccessToken(): string | null {
    if (!this.tokens) return null;
    if (this.tokens.expiresAt < Date.now()) return null;
    return this.tokens.accessToken;
  }

  logout(): void {
    this.tokens = null;
    // Clear server-side session
    fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  }
}

export const authManager = new AuthManager();
