import { defineEndpoint } from "@aiogram/tgcloud-grammy";
import { EndpointError, db } from "sdk";
import { eq } from "sdk/db";
import { parseProgress, type Progress } from "../../shared/progress.js";
import { syncProgress, type ProgressStore } from "../../shared/sync-progress.js";
import { progress } from "../schema.js";

interface SyncInput {
  progress: unknown;
}

export default defineEndpoint<SyncInput, { progress: Progress; serverTime: number }>(async (input, ctx) => {
  const user = ctx.initData.user;
  if (!user) throw new EndpointError("Open Wortschatz from Telegram to sync.", { code: "NO_USER" });
  if (!input || typeof input !== "object" || Array.isArray(input) || !("progress" in input)) {
    throw new EndpointError("Invalid progress payload.", { code: "BAD_INPUT" });
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    throw new EndpointError("Invalid progress payload.", { code: "BAD_INPUT" });
  }
  if (serialized.length > 512_000) {
    throw new EndpointError("Progress payload is too large.", { code: "TOO_LARGE" });
  }

  const incoming = parseProgress(input.progress);
  if (!incoming) throw new EndpointError("Invalid progress payload.", { code: "BAD_INPUT" });

  const store: ProgressStore = {
    async read(userId) {
      const row = await db.select().from(progress).where(eq(progress.userId, userId)).get();
      return row ? { data: row.data } : null;
    },
    async insertIfAbsent(userId, data, updatedAt) {
      const result = await db.insert(progress).values({ userId, data, updatedAt })
        .onConflictDoNothing({ target: progress.userId }).run();
      return result.rowsAffected === 1;
    },
    async compareAndSet(userId, expected, data, updatedAt) {
      const rows = await db.update(progress).set({ data, updatedAt })
        .where(eq(progress.userId, userId), eq(progress.data, expected))
        .returning({ userId: progress.userId }).run();
      return rows.length === 1;
    },
  };
  const merged = await syncProgress(store, user.id, incoming);

  return { progress: merged, serverTime: Date.now() };
});
