import { ulid } from "@std/ulid/ulid";
import { customAlphabet, nanoid } from "nanoid";
import { Router } from "@fartlabs/rt";
import { InvitesKv } from "./lib/db.ts";
import { createInviteParamsSchema, listParamsSchema } from "./lib/schemas.ts";

const kv = await Deno.openKv();
const invitesKv = new InvitesKv(kv);

export const router: Router = new Router()
  .get("/v1/invites", async (ctx) => {
    if (ctx.request.headers.get("Accept")?.includes("text/html")) {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    const apiKey = Deno.env.get("API_KEY");
    if (apiKey && ctx.request.headers.get("X-Api-Key") !== apiKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(ctx.request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitString = url.searchParams.get("limit") ?? "20";
    const reverseString = url.searchParams.get("reverse") ?? "true";

    const listParamsResult = listParamsSchema.safeParse({
      cursor,
      limit: parseInt(limitString),
      reverse: reverseString === "true",
    });

    if (!listParamsResult.success) {
      return Response.json(
        {
          error: "Invalid list parameters",
          details: listParamsResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { cursor: paramsCursor, limit, reverse } = listParamsResult.data;

    const { items, cursor: nextCursor } = await invitesKv.list({
      limit,
      reverse,
      cursor: paramsCursor,
    });

    return Response.json({ items, cursor: nextCursor });
  })
  .post("/v1/invites", async (ctx) => {
    const apiKey = Deno.env.get("API_KEY");
    if (apiKey && ctx.request.headers.get("X-Api-Key") !== apiKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body = {};
    try {
      body = await ctx.request.json();
    } catch {
      // Empty body is okay
    }

    const parseResult = createInviteParamsSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json(
        { error: "Invalid parameters", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const url = new URL(ctx.request.url);
    const alphabet = url.searchParams.get("alphabet");
    const sizeString = url.searchParams.get("size");
    const size = sizeString ? parseInt(sizeString) : undefined;

    const code = parseResult.data.code ??
      (alphabet
        ? customAlphabet(alphabet, size ?? 21)()
        : (size ? nanoid(size) : ulid()));
    const now = Date.now();
    const invite = {
      code,
      createdAt: now,
      redeemedBy: null,
      redeemedAt: null,
    };

    await invitesKv.add(invite);
    return Response.json(invite, { status: 201 });
  })
  .get("/v1/invites/:code", async (ctx) => {
    const apiKey = Deno.env.get("API_KEY");
    if (apiKey && ctx.request.headers.get("X-Api-Key") !== apiKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = ctx.params?.pathname.groups.code;
    if (!code) {
      return Response.json({ error: "Invite code required" }, {
        status: 400,
      });
    }

    const invite = await invitesKv.get(code);
    if (!invite) {
      return Response.json({ error: "Invite not found" }, { status: 404 });
    }

    return Response.json(invite);
  })
  .delete("/v1/invites/:code", async (ctx) => {
    const apiKey = Deno.env.get("API_KEY");
    if (apiKey && ctx.request.headers.get("X-Api-Key") !== apiKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = ctx.params?.pathname.groups.code;
    if (!code) {
      return Response.json({ error: "Invite code required" }, {
        status: 400,
      });
    }

    await invitesKv.delete(code);
    return new Response(null, { status: 204 });
  })
  .delete("/v1/invites", async (ctx) => {
    const apiKey = Deno.env.get("API_KEY");
    if (apiKey && ctx.request.headers.get("X-Api-Key") !== apiKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(ctx.request.url);
    const all = url.searchParams.get("all") === "true";

    if (all) {
      await invitesKv.deleteAll();
      return new Response(null, { status: 204 });
    }

    let body: { codes?: string[] } = {};
    try {
      body = await ctx.request.json();
    } catch {
      // Body might be empty
    }

    if (!body.codes || !Array.isArray(body.codes)) {
      return Response.json(
        { error: "Invalid parameters. 'codes' array or 'all=true' required." },
        { status: 400 },
      );
    }

    await invitesKv.deleteMany(body.codes);
    return new Response(null, { status: 204 });
  })
  .post("/v1/reindex", async (ctx) => {
    const apiKey = Deno.env.get("API_KEY");
    if (apiKey && ctx.request.headers.get("X-Api-Key") !== apiKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await invitesKv.reindex();
    return Response.json({
      message: `Successfully reindexed ${count} invites.`,
    });
  });

const server: Deno.ServeDefaultExport = {
  fetch: (req) => router.fetch(req),
};

export default server;
