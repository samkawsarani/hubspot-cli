import * as path from "path";
import * as os from "os";
import { config as dotenvConfig } from "dotenv";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "hubspot");
export const CONFIG_ENV = path.join(CONFIG_DIR, ".env");

const BASE_URL = "https://api.hubapi.com";

export function loadConfig(): void {
  dotenvConfig({ path: CONFIG_ENV });
  dotenvConfig({ path: path.join(process.cwd(), ".env"), override: true });
}

loadConfig();

export class APIError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class HubSpotClient {
  private readonly token: string;

  constructor(token?: string) {
    const t = token ?? process.env.HUBSPOT_ACCESS_TOKEN;
    if (!t) {
      throw new Error(
        "HUBSPOT_ACCESS_TOKEN not set. Run `hubspot init` to configure.",
      );
    }
    this.token = t;
  }

  private async _request(url: URL, init: RequestInit): Promise<unknown> {
    let retries = 0;
    while (true) {
      const response = await fetch(url.toString(), {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 429 && retries < 3) {
        const wait = parseFloat(response.headers.get("Retry-After") ?? "1");
        await new Promise((r) => setTimeout(r, wait * 1000));
        retries++;
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        let message: string;
        try {
          const data = JSON.parse(text) as { message?: string };
          message = data.message ?? `HTTP ${response.status}`;
        } catch {
          message = text || `HTTP ${response.status}`;
        }
        throw new APIError(response.status, `HubSpot API error: ${message}`);
      }

      return await response.json();
    }
  }

  async get(
    urlPath: string,
    params?: Record<string, string | number | string[]>,
  ): Promise<unknown> {
    const url = new URL(BASE_URL + urlPath);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) {
          url.searchParams.set(k, v.join(","));
        } else {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return this._request(url, {});
  }

  async post(urlPath: string, body: unknown): Promise<unknown> {
    const url = new URL(BASE_URL + urlPath);
    return this._request(url, { method: "POST", body: JSON.stringify(body) });
  }
}

let _client: HubSpotClient | null = null;

export function getClient(): HubSpotClient {
  if (!_client) {
    _client = new HubSpotClient();
  }
  return _client;
}

export function _setClient(client: HubSpotClient | null): void {
  _client = client;
}
