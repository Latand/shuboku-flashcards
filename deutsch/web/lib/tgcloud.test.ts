import { afterEach, describe, expect, test } from "bun:test";
import { callEndpoint } from "./tgcloud";

const root = globalThis as unknown as Record<string, unknown>;
const originalWindow = root.window;

afterEach(() => {
  if (originalWindow === undefined) Reflect.deleteProperty(root, "window");
  else Object.defineProperty(root, "window", { configurable: true, value: originalWindow });
});

describe("Telegram Serverless endpoint bridge", () => {
  test("refuses outside Telegram without attempting a request", async () => {
    Reflect.deleteProperty(root, "window");
    await expect(callEndpoint("sync", {})).rejects.toThrow("outside-telegram");
  });

  test("uses the authenticated Mini App Serverless bridge", async () => {
    const calls: unknown[][] = [];
    Object.defineProperty(root, "window", {
      configurable: true,
      value: {
        Telegram: {
          WebApp: {
            initData: "signed-init-data",
            Serverless: {
              call: (name: string, input: unknown, callback: (error: Error | null, result: unknown) => void) => {
                calls.push([name, input]);
                callback(null, { progress: { version: 1 } });
              },
            },
          },
        },
      },
    });

    const result = await callEndpoint<{ progress: { version: number } }>("sync", { progress: {} });
    expect(calls).toEqual([["sync", { progress: {} }]]);
    expect(result.progress.version).toBe(1);
  });
});
