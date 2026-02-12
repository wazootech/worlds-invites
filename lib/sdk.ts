import type { CreateInviteParams, Invite, ListParams } from "./schemas.ts";

/**
 * Options for creating an InvitesSdk.
 */
export interface InvitesSdkOptions {
  /**
   * The base URL of the invites API.
   */
  baseUrl: string;

  /**
   * Optional custom fetch function.
   */
  fetch?: typeof fetch;
}

/**
 * InvitesSdk is a client for the invites API.
 */
export class InvitesSdk {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;

  public constructor(options: InvitesSdkOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * List invite codes.
   */
  async list(params: ListParams = { limit: 20, reverse: false }): Promise<{
    items: Invite[];
    cursor: string;
  }> {
    const url = new URL(`${this.baseUrl}/v1/invites`);
    if (params.cursor) {
      url.searchParams.set("cursor", params.cursor);
    }
    url.searchParams.set("limit", params.limit.toString());
    url.searchParams.set("reverse", params.reverse.toString());

    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list invites: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new invite code.
   */
  async create(params: CreateInviteParams = {}): Promise<Invite> {
    const url = new URL(`${this.baseUrl}/v1/invites`);
    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Failed to create invite: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get an invite code by code.
   */
  async get(code: string): Promise<Invite> {
    const url = new URL(`${this.baseUrl}/v1/invites/${code}`);
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to get invite: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete an invite code.
   */
  async delete(code: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/v1/invites/${code}`);
    const response = await this.fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete invite: ${response.statusText}`);
    }

    if (response.status !== 204) {
      // Consume body to avoid leaking resources
      await response.body?.cancel();
    }
  }
}
