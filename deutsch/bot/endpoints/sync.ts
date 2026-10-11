import { defineEndpoint } from "@aiogram/tgcloud-grammy";
import { EndpointError, db } from "sdk";
import { eq } from "sdk/db";
import { mergeProgress, parseProgress, type Progress } from "../../shared/progress.js";
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

  const existing = await db.select().from(progress).where(eq(progress.userId, user.id)).get();
  const merged = mergeProgress(existing?.data ?? null, incoming);
  if (!existing || JSON.stringify(existing.data) !== JSON.stringify(merged)) {
    await db
      .insert(progress)
      .values({ userId: user.id, data: merged, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: progress.userId,
        set: { data: merged, updatedAt: Date.now() },
      });
  }

  return { progress: merged, serverTime: Date.now() };
});
