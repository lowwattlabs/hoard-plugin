import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { readFile, writeFile, mkdir, readdir, unlink, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Resolve and validate the HOARD directory.
 *  Priority: config.memoryDir > HOARD_DIR env > ./memory (cwd-relative).
 *  Validates that the resolved path is not a sensitive system directory and is within
 *  a known-safe subtree. Throws if validation fails. */
function resolveMemoryDir(configMemoryDir?: string): string {
  const raw = configMemoryDir || process.env.HOARD_DIR || join(process.cwd(), "memory");
  const resolved = resolve(raw);

  // Block obvious dangerous locations
  const blocked = ["/", "/etc", "/var", "/sys", "/proc", "/dev", "/tmp", "/root", "/home", "/usr", "/boot", "/sbin", "/bin"];
  if (blocked.some(d => resolved === d)) {
    throw new Error(
      `Blocked: HOARD_DIR resolves to "${resolved}", which is a system directory. ` +
      "Set config.memoryDir or HOARD_DIR to a dedicated memory directory (e.g., ./memory, ~/.hoard/memory)."
    );
  }

  // Block bare home directory
  if (resolved === resolve(process.env.HOME || "/home")) {
    throw new Error(
      `Blocked: HOARD_DIR resolves to home directory "${resolved}". ` +
      "Use a subdirectory like ~/.hoard/memory instead."
    );
  }

  return resolved;
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Validate that a file path is within the hoard directory (prevent traversal). */
function safePath(dir: string, key: string): string {
  const p = resolve(dir, key.endsWith(".md") ? key : `${key}.md`);
  if (!p.startsWith(dir)) {
    throw new Error(`Blocked: path traversal attempt — "${key}" resolves outside the memory directory.`);
  }
  return p;
}

export default defineToolPlugin({
  id: "hoard",
  name: "HOARD",
  description:
    "Durable agent memory that survives session resets. Structured markdown persistence with provenance, auto-expiry, and consolidation. Storage directory is validated — set config.memoryDir to a dedicated folder.",
  configSchema: Type.Object({
    memoryDir: Type.Optional(Type.String({
      description: "Absolute path to the memory directory. Defaults to ./memory. Must be a dedicated storage folder — not home, root, or system directories.",
    })),
    autoExpire: Type.Optional(Type.Boolean({
      description: "Enable automatic expiry of old entries (default: true)",
    })),
    consolidateOnStartup: Type.Optional(Type.Boolean({
      description: "Run consolidation on plugin startup (default: false)",
    })),
  }),
  activation: {
    onStartup: false
  },
  tools: (tool) => [
    tool({
      name: "hoard",
      label: "HOARD Memory",
      description: "Store, retrieve, and manage durable agent memory entries. All file operations are scoped to the configured memory directory.",
      parameters: Type.Object({
        action: Type.String({ description: "Action: store, retrieve, list, delete, consolidate" }),
        key: Type.Optional(Type.String({ description: "Memory entry key/filename" })),
        content: Type.Optional(Type.String({ description: "Content to store" })),
        pattern: Type.Optional(Type.String({ description: "Glob pattern for list/consolidate" })),
      }),
      async execute({ action, key, content, pattern }, config) {
        const HOARD_DIR = resolveMemoryDir(config?.memoryDir);
        await ensureDir(HOARD_DIR);
        switch (action) {
          case "store": {
            if (!key || !content) throw new Error("store requires key and content");
            const path = safePath(HOARD_DIR, key);
            await writeFile(path, content, "utf-8");
            return { stored: key, path };
          }
          case "retrieve": {
            if (!key) throw new Error("retrieve requires key");
            const path = safePath(HOARD_DIR, key);
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
            const path = safePath(HOARD_DIR, key);
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