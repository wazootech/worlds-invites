import type { Invite, ListParams } from "./schemas.ts";

/**
 * InvitesKv is a class that provides a simple API for managing invites.
 */
export class InvitesKv {
  public constructor(private readonly kv: Deno.Kv) {}

  public async add(invite: Invite): Promise<void> {
    const key = ["invites", invite.code];
    const indexKey = ["invites_by_createdAt", invite.createdAt, invite.code];
    const res = await this.kv.atomic()
      .set(key, invite)
      .set(indexKey, invite)
      .commit();
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
    const invite = await this.get(code);
    if (!invite) return;

    const key = ["invites", code];
    const indexKey = ["invites_by_createdAt", invite.createdAt, code];
    await this.kv.atomic()
      .delete(key)
      .delete(indexKey)
      .commit();
  }

  public async deleteMany(codes: string[]): Promise<void> {
    const atomic = this.kv.atomic();
    for (const code of codes) {
      const invite = await this.get(code);
      if (invite) {
        atomic.delete(["invites", code]);
        atomic.delete(["invites_by_createdAt", invite.createdAt, code]);
      }
    }
    const res = await atomic.commit();
    if (!res.ok) {
      throw new Error("Failed to delete invites");
    }
  }

  public async deleteAll(): Promise<void> {
    const prefixes = [["invites"], ["invites_by_createdAt"]];
    const atomic = this.kv.atomic();

    for (const prefix of prefixes) {
      const iter = this.kv.list({ prefix });
      for await (const res of iter) {
        atomic.delete(res.key);
      }
    }

    const res = await atomic.commit();
    if (!res.ok) {
      throw new Error("Failed to delete all invites");
    }
  }

  public async list(
    options?: ListParams,
  ): Promise<{ items: Invite[]; cursor: string }> {
    const listOptions: Deno.KvListOptions = {
      limit: 20,
      reverse: true,
      ...options,
    };

    const prefix = ["invites_by_createdAt"];
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

  /**
   * reindex populates the secondary index for all existing invites.
   */
  public async reindex(): Promise<number> {
    const iter = this.kv.list<Invite>({ prefix: ["invites"] });
    let count = 0;
    for await (const res of iter) {
      const invite = res.value;
      const indexKey = ["invites_by_createdAt", invite.createdAt, invite.code];
      await this.kv.set(indexKey, invite);
      count++;
    }

    return count;
  }
}
