import { createAppJwt, type AppAuthOptions } from "./auth.js";

export interface InstallationToken {
  token: string;
  expiresAt: number;
}

export interface TokenResponse {
  token: string;
  expires_at: string;
}

export interface InstallationTokenStore {
  get(installationId: number): InstallationToken | undefined;
  set(installationId: number, token: InstallationToken): void;
  clear(installationId?: number): void;
}

export class MemoryTokenStore implements InstallationTokenStore {
  private readonly tokens = new Map<number, InstallationToken>();

  get(installationId: number): InstallationToken | undefined {
    return this.tokens.get(installationId);
  }

  set(installationId: number, token: InstallationToken): void {
    this.tokens.set(installationId, token);
  }

  clear(installationId?: number): void {
    if (installationId === undefined) {
      this.tokens.clear();
      return;
    }
    this.tokens.delete(installationId);
  }
}

export interface InstallationTokenClient {
  requestToken(installationId: number, jwt: string): Promise<TokenResponse>;
}

const REFRESH_SKEW_MS = 60_000;

export class InstallationAuth {
  private readonly store: InstallationTokenStore;

  constructor(
    private readonly app: AppAuthOptions,
    private readonly client: InstallationTokenClient,
    store?: InstallationTokenStore,
  ) {
    this.store = store ?? new MemoryTokenStore();
  }

  async getToken(installationId: number, now = Date.now()): Promise<string> {
    const cached = this.store.get(installationId);
    if (cached && cached.expiresAt - REFRESH_SKEW_MS > now) {
      return cached.token;
    }
    const jwt = createAppJwt({ ...this.app, now: () => now });
    const issued = await this.client.requestToken(installationId, jwt);
    this.store.set(installationId, {
      token: issued.token,
      expiresAt: Date.parse(issued.expires_at),
    });
    return issued.token;
  }
}

export function createGitHubTokenClient(fetchImpl: typeof fetch = fetch): InstallationTokenClient {
  return {
    async requestToken(installationId, jwt) {
      const response = await fetchImpl(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${jwt}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "breakline",
        },
      });
      if (!response.ok) {
        throw new Error(`GitHub installation token request failed (${response.status})`);
      }
      return (await response.json()) as TokenResponse;
    },
  };
}
