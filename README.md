# HOARD — OpenClaw Plugin

Durable agent memory that survives session resets. Structured markdown persistence with provenance, auto-expiry, and consolidation.

## ⚠️ Storage Directory Disclosures

- HOARD writes files to a local directory controlled by `config.memoryDir` or the `HOARD_DIR` environment variable (default: `./memory`).
- The storage directory is **validated** — it must be a dedicated folder, not a system directory (`/etc`, `/var`, `/usr`, etc.), your home directory, or root. Set `config.memoryDir` to an explicit path like `~/.hoard/memory` or `./memory`.
- All file operations (store, retrieve, delete) are scoped to the configured memory directory. Path traversal attempts are blocked.
- HOARD does **not** transmit data externally. All storage is local filesystem only.

## Install

```bash
openclaw plugins install clawhub:@lowwattlabs/hoard
```

## Configuration

```json
{
  "hoard": {
    "memoryDir": "./memory",
    "autoExpire": true,
    "consolidateOnStartup": false
  }
}
```

- **memoryDir**: Absolute path to the memory directory. Defaults to `./memory`. Must be a dedicated storage folder — not home, root, or system directories. Validated on startup.
- **autoExpire**: Automatically expire old entries (default: `true`).
- **consolidateOnStartup**: Run consolidation when the plugin loads (default: `false`). Plugin uses lazy activation — only loads when called.

## What it does

HOARD gives your agent a persistent memory store that outlives any single session. Entries are markdown files with frontmatter metadata — provenance tracking, automatic expiry, and consolidation to keep memory manageable.

## Links

- **GitHub**: https://github.com/lowwattlabs/hoard-plugin
- **ClawHub**: https://clawhub.ai/lowwattlabs/hoard

## License

MIT-0