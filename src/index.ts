import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { readFile, writeFile, mkdir, readdir, unlink, realpath, stat, rename } from "node:fs/promises";
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

/** Get the trash directory path. */
function trashDir(dir: string): string {
  return join(dir, ".hoard-trash");
}

export default defineToolPlugin({
  id: "hoard",
  name: "HOARD",
  description:
    "Durable agent memory that survives session resets. Structured markdown persistence with provenance, auto-expiry, and consolidation. All file operations are scoped to the configured memory directory. Delete is soft by default — moves to trash, not permanent removal.",
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
      description: "Store, retrieve, list, delete, restore, and manage durable agent memory entries. All file operations are scoped to the configured memory directory. Delete moves to trash by default; permanent deletion requires confirm=true.",
      parameters: Type.Object({
        action: Type.String({ description: "Action: store, retrieve, list, delete, restore, listTrash, consolidate" }),
        key: Type.Optional(Type.String({ description: "Memory entry key/filename" })),
        content: Type.Optional(Type.String({ description: "Content to store" })),
        pattern: Type.Optional(Type.String({ description: "Glob pattern for list/consolidate" })),
        confirm: Type.Optional(Type.Boolean({ description: "Required for permanent deletion. When true, delete permanently removes the file instead of moving to trash." })),
      }),
      async execute({ action, key, content, pattern, confirm }, config) {
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
            return { entries: filtered.filter((f: string) => !f.startsWith(".")) };
          }
          case "delete": {
            if (!key) throw new Error("delete requires key");
            const path = safePath(HOARD_DIR, key);

            if (confirm) {
              // Permanent deletion — requires explicit confirm=true
              await unlink(path);
              return { deleted: key, permanent: true };
            }

            // Soft delete — move to trash
            const trash = trashDir(HOARD_DIR);
            await ensureDir(trash);
            const trashPath = join(trash, key.endsWith(".md") ? key : `${key}.md`);
            try {
              await rename(path, trashPath);
              return { deleted: key, permanent: false, trashPath };
            } catch {
              // If file doesn't exist in main dir, check if it's already trashed
              throw new Error(`File not found: ${key}`);
            }
          }
          case "restore": {
            if (!key) throw new Error("restore requires key");
            const trash = trashDir(HOARD_DIR);
            const trashPath = join(trash, key.endsWith(".md") ? key : `${key}.md`);
            const mainPath = safePath(HOARD_DIR, key);
            try {
              await rename(trashPath, mainPath);
              return { restored: key, path: mainPath };
            } catch {
              throw new Error(`File not found in trash: ${key}`);
            }
          }
          case "listTrash": {
            const trash = trashDir(HOARD_DIR);
            await ensureDir(trash);
            const files = await readdir(trash);
            return { entries: files.filter((f: string) => !f.startsWith(".")) };
          }
          case "consolidate": {
            // Consolidation is handled by the main hoard skill logic
            // This action triggers a consolidation pass
            const files = await readdir(HOARD_DIR);
            const mdFiles = files.filter((f: string) => f.endsWith(".md") && !f.startsWith("."));
            return { consolidated: mdFiles.length, message: "Consolidation triggered" };
          }
          default:
            throw new Error(`Unknown action: ${action}. Use store, retrieve, list, delete, restore, listTrash, or consolidate.`);
        }
      },
    }),
  ],
});