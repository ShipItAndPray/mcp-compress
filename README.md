# mcp-compress

The first MCP server for data compression. Gives any AI agent the ability to compress, decompress, analyze, and store data.

10,000+ MCP servers exist. Zero for compression. This is the first.

## Install

Add to your Claude Code `settings.json`:

```json
"mcpServers": {
  "compress": {
    "command": "npx",
    "args": ["-y", "mcp-compress"]
  }
}
```

Or run standalone:

```bash
npx mcp-compress
```

## Tools

| Tool | What it does |
|------|-------------|
| `compress` | Compress text/JSON/CSV. Auto-picks best algorithm (gzip, brotli, deflate). Returns base64 + ratio. |
| `decompress` | Decompress back to original. Lossless round-trip. |
| `analyze` | Show entropy, compressibility rating, best algorithm, recommendation. Use before deciding to compress. |
| `store` | Compress and save to disk with a key. Compressed key-value store for agents. |
| `retrieve` | Decompress and return stored data by key. |
| `list` | List all stored items with sizes and compression ratios. |
| `stats` | Total items, bytes saved, overall compression ratio. |

## Examples

**Agent compresses API response before caching:**
```
> compress(data: "<large JSON>", algorithm: "auto")
← { ratio: "4.2x", saved: "3,891 bytes", algorithm: "brotli" }
```

**Agent analyzes if data is worth compressing:**
```
> analyze(data: "<csv data>")
← { compressibility: "HIGH", best_ratio: "6.1x", recommendation: "compress everything" }
```

**Agent stores research for later:**
```
> store(data: "<research notes>", name: "market-analysis-march")
> retrieve(key: "market-analysis-march")
← original data, decompressed
```

## Why

- AI agents generate and consume large amounts of text
- Context windows are expensive — compressed storage saves money
- MCP is the standard for agent tools — compression should be built in
- No other MCP server does this

## License

MIT
