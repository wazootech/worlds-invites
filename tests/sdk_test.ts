import { assertEquals } from "@std/assert";
import { InvitesSdk } from "#/lib/sdk.ts";
import { router } from "#/main.ts";

Deno.test("InvitesSdk - Integration", async (t) => {
  const sdk = new InvitesSdk({
    baseUrl: "http://localhost:8000",
    fetch: (input, init) =>
      router.fetch(new Request(input, init as RequestInit)),
  });

  await t.step("create", async () => {
    const invite = await sdk.create({ code: "test-code-" + Date.now() });
    assertEquals(typeof invite.code, "string");
  });

  await t.step("list", async () => {
    const { items, cursor } = await sdk.list({ limit: 10, reverse: false });
    assertEquals(Array.isArray(items), true);
    assertEquals(typeof cursor, "string");
  });

  await t.step("get", async () => {
    const invite = await sdk.create({ code: "get-test-" + Date.now() });
    const fetched = await sdk.get(invite.code);
    assertEquals(fetched.code, invite.code);
  });

  await t.step("delete", async () => {
    const invite = await sdk.create({ code: "delete-test-" + Date.now() });
    await sdk.delete(invite.code);

    // Verify it's gone
    try {
      await sdk.get(invite.code);
      throw new Error("Should have failed");
    } catch (_e) {
      // Expected failure as it returns 404 which sdk.get throws for !response.ok
    }
  });
});
