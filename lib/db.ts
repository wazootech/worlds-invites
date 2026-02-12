import type { Invite, ListParams } from "./schemas.ts";

/**
 * InvitesKv is a class that provides a simple API for managing invites.
 */
export class InvitesKv {
  public constructor(private readonly kv: Deno.Kv) {}

  public async add(invite: Invite): Promise<void> {
    const key = ["invites", invite.code];
    const res = await this.kv.set(key, invite);
    if (!res.ok) {
      throw new Error("Failed to add invite");
    }
  }

  public async get(code: string): Promise<Invite | null> {
    const key = ["invites", code];
    const res = await this.kv.get<Invite>(key);
    return res.value;
  }

  public async delete(code: string): Promise<void> {
    const key = ["invites", code];
    await this.kv.delete(key);
  }

  public async list(
    options?: ListParams,
  ): Promise<{ items: Invite[]; cursor: string }> {
    const listOptions: Deno.KvListOptions = {
      limit: 20,
      ...options,
    };

    // Default prefix is "invites", can use selector to override start/end if needed
    // But for simple list all, prefix is easiest.
    // If we want range, we would construct selector outside or pass prefix here.
    // Let's assume listing all invites:
    const prefix = ["invites"];

    const iter = this.kv.list<Invite>({ prefix }, listOptions);
    const items: Invite[] = [];

    for await (const res of iter) {
      items.push(res.value);
    }

    return {
      items,
      cursor: iter.cursor,
    };
  }
}
