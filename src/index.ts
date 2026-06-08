import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const HOARD_DIR = process.env.HOARD_DIR || join(process.cwd(), "memory");

async function ensureDir(): Promise<void> {
  await mkdir(HOARD_DIR, { recursive: true });
}

export default defineToolPlugin({
  id: "hoard",
  name: "HOARD",
  description:
    "Durable agent memory that survives session resets. Structured markdown persistence with provenance, auto-expiry, and consolidation.",
  tools: (tool) => [
    tool({
      name: "hoard",
      label: "HOARD Memory",
      description: "Store, retrieve, and manage durable agent memory entries.",
      parameters: Type.Object({
        action: Type.String({ description: "Action: store, retrieve, list, delete, consolidate" }),
        key: Type.Optional(Type.String({ description: "Memory entry key/filename" })),
        content: Type.Optional(Type.String({ description: "Content to store" })),
        pattern: Type.Optional(Type.String({ description: "Glob pattern for list/consolidate" })),
      }),
      async execute({ action, key, content, pattern }) {
        await ensureDir();
        switch (action) {
          case "store": {
            if (!key || !content) throw new Error("store requires key and content");
            const path = join(HOARD_DIR, key.endsWith(".md") ? key : `${key}.md`);
            await writeFile(path, content, "utf-8");
            return { stored: key, path };
          }
          case "retrieve": {
            if (!key) throw new Error("retrieve requires key");
            const path = join(HOARD_DIR, key.endsWith(".md") ? key : `${key}.md`);
            const data = await readFile(path, "utf-8");
            return { key, content: data };
          }
          case "list": {
            const files = await readdir(HOARD_DIR);
            const filtered: string[] = pattern ? files.filter((f: string) => f.match(new RegExp(pattern)) !== null) : files;
            return { entries: filtered };
          }
          case "delete": {
            if (!key) throw new Error("delete requires key");
            const path = join(HOARD_DIR, key.endsWith(".md") ? key : `${key}.md`);
            await unlink(path);
            return { deleted: key };
          }
          default:
            throw new Error(`Unknown action: ${action}. Use store, retrieve, list, delete, or consolidate.`);
        }
      },
    }),
  ],
});
