import { integer, json, table } from "sdk/db";
import type { Progress } from "../shared/progress.js";

/** One merged progress document per Telegram user. */
export const progress = table("progress", {
  userId: integer("user_id").primaryKey(),
  data: json<Progress>("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
