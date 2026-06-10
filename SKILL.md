# HOARD — History Organization & Agent Recall Database

Durable agent memory that survives session resets. Structured markdown persistence with provenance, auto-expiry, and consolidation.

## What it does

HOARD gives your agent a persistent memory store that outlives any single session. Entries are markdown files with frontmatter metadata — provenance tracking, automatic expiry, and consolidation to keep memory manageable.

## Safety

- All file operations are scoped to the configured memory directory. Path traversal attempts are blocked.
- **Delete is soft by default** — files are moved to `.hoard-trash/` instead of being permanently removed. Permanent deletion requires explicit `confirm: true`.
- Use `restore` to recover trashed entries and `listTrash` to see what's in the trash.
- The memory directory is validated on startup — system directories (/etc, /var, /home, etc.) are blocked.

## Actions

| Action | Description |
|--------|-------------|
| `store` | Store a new memory entry (requires key + content) |
| `retrieve` | Read a memory entry by key |
| `list` | List all entries (optional glob pattern) |
| `delete` | Soft-delete — moves to .hoard-trash (permanent with confirm=true) |
| `restore` | Restore a trashed entry back to memory |
| `listTrash` | List entries in the trash |
| `consolidate` | Trigger a consolidation pass |

## Who is this for

Any OpenClaw agent that needs to remember things between sessions. If your agent forgets everything when the context resets, HOARD fixes that.

## Links

- **GitHub**: https://github.com/lowwattlabs/hoard-plugin
- **ClawHub**: https://clawhub.ai/lowwattlabs/hoard

## License

MIT-0