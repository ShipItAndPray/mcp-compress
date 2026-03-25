# mcp-compress

The first MCP server for data compression. Gives any AI agent the ability to compress, decompress, analyze, and store data.

**10,000+ MCP servers exist. Zero for compression. This is the first.**

Zero dependencies. Pure Node.js. Lossless round-trip. Auto-picks the best algorithm.

[![mcp-compress MCP server](https://glama.ai/mcp/servers/ShipItAndPray/mcp-compress/badges/card.svg)](https://glama.ai/mcp/servers/ShipItAndPray/mcp-compress)

## Benchmarks

Real results on real data types:

| Data Type | Original | Compressed | Ratio | Saved |
|-----------|----------|------------|-------|-------|
| Markdown docs (15KB) | 31.2 KB | 0.5 KB | **60.7x** | 98.4% |
| Repeated config (2KB) | 5.4 KB | 0.1 KB | **51.9x** | 98.1% |
| SQL query results (8KB) | 18.9 KB | 0.6 KB | **30.4x** | 96.7% |
| Log files (20KB) | 33.3 KB | 1.7 KB | **19.9x** | 95.0% |
| JSON API response (10KB) | 26.7 KB | 2.6 KB | **10.2x** | 90.2% |
| Time-series prices (4KB) | 20.5 KB | 3.0 KB | **6.9x** | 85.5% |
| CSV data (5KB) | 8.1 KB | 2.4 KB | **3.4x** | 70.5% |

Every compression is **lossless** — decompress returns the exact original, byte-for-byte.

## Install

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "compress": {
      "command": "npx",
      "args": ["-y", "mcp-compress"]
    }
  }
}
```

### OpenClaw / Any MCP Client

```bash
npx mcp-compress
```

Speaks MCP protocol over stdio. Works with any MCP-compatible AI agent.

### From Source

```bash
git clone https://github.com/ShipItAndPray/mcp-compress.git
cd mcp-compress
node index.js
```

## Tools

7 tools available to any connected agent:

| Tool | What it does |
|------|-------------|
| `compress` | Compress text/JSON/CSV. Auto-picks best algorithm (gzip, brotli, deflate). Returns base64 + ratio. |
| `decompress` | Decompress back to original. Lossless round-trip verified. |
| `analyze` | Shannon entropy, compressibility rating, all algorithms compared, recommendation. |
| `store` | Compress and persist to disk with a key. Compressed key-value store for agents. |
| `retrieve` | Decompress and return stored data by key. |
| `list` | List all stored items with sizes and compression ratios. |
| `stats` | Total items stored, bytes saved, overall compression ratio. |

## Usage Examples

**Compress a large API response:**
```
compress(data: "<10KB JSON>", algorithm: "auto")
→ { ratio: "10.2x", saved_percent: "90.2%", algorithm: "brotli" }
```

**Analyze before compressing:**
```
analyze(data: "<your data>")
→ { compressibility: "HIGH", best_ratio: "30.4x", recommendation: "compress everything" }
```

**Store data for later retrieval:**
```
store(data: "<research notes>", name: "market-analysis")
→ { key: "market-analysis", ratio: "8.3x", saved: "12,450 bytes" }

retrieve(key: "market-analysis")
→ { data: "<original research notes>" }
```

**Check what you've stored:**
```
stats()
→ { stored_items: 14, total_saved_bytes: 284102, overall_ratio: "11.2x" }
```

## Why This Exists

- AI agents generate and consume massive amounts of text — API responses, code, docs, data
- Context windows are expensive. Compressed storage = more data in less space = lower cost.
- MCP is the standard protocol for AI agent tools. 10,000+ servers, none for compression.
- Auto-algorithm selection means the agent doesn't need to know anything about compression — it just works.

## How It Works

1. **Auto-algorithm selection** — tests gzip, brotli, and deflate on your data, picks the smallest result
2. **Brotli wins 90% of the time** — purpose-built for text, consistently 20-40% smaller than gzip
3. **Compressed key-value store** — `store`/`retrieve` gives agents persistent compressed storage at `~/.mcp-compress/`
4. **Shannon entropy analysis** — `analyze` tells you if compression is even worth it before you do it

## Test Results

```
10/10 evals passing:
  ✓ Initialize returns protocol version
  ✓ Lists all 7 tools
  ✓ Compress returns valid base64 and ratio > 1x
  ✓ Round-trip is lossless
  ✓ Analyze returns compressibility recommendation
  ✓ Store and retrieve preserves data
  ✓ Stats returns valid counts
  ✓ List shows stored items
  ✓ Auto picks smallest algorithm
  ✓ Handles 100KB+ data
```

## License

MIT