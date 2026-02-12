import { ulid } from "@std/ulid";
import { Delete, Get, Post, Router } from "@fartlabs/rtx";
import { InvitesKv } from "./lib/db.ts";
import { createInviteParamsSchema, listParamsSchema } from "./lib/schemas.ts";

const kv = await Deno.openKv();
const invitesKv = new InvitesKv(kv);

const router = (
  <Router>
    <Get
      pattern="/v1/invites"
      handler={async (ctx) => {
        const url = new URL(ctx.request.url);
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const limitString = url.searchParams.get("limit") ?? "20";
        const reverseString = url.searchParams.get("reverse") ?? "false";

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
      }}
    />
    <Post
      pattern="/v1/invites"
      handler={async (ctx) => {
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

        const code = parseResult.data.code ?? ulid();
        const now = Date.now();
        const invite = {
          code,
          createdAt: now,
          redeemedBy: null,
          redeemedAt: null,
        };

        await invitesKv.add(invite);
        return Response.json(invite, { status: 201 });
      }}
    />
    <Get
      pattern="/v1/invites/:code"
      handler={async (ctx) => {
        // @ts-ignore: types are a bit loose with rtx/rt
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
      }}
    />
    <Delete
      pattern="/v1/invites/:code"
      handler={async (ctx) => {
        // @ts-ignore: types are a bit loose with rtx/rt
        const code = ctx.params?.pathname.groups.code;
        if (!code) {
          return Response.json({ error: "Invite code required" }, {
            status: 400,
          });
        }

        await invitesKv.delete(code);
        return new Response(null, { status: 204 });
      }}
    />
  </Router>
);

export default {
  fetch: (req, info) => router.fetch(req, info),
} satisfies Deno.ServeDefaultExport;
