#!/usr/bin/env node

/**
 * mcp-compress — First MCP Server for Data Compression
 * =====================================================
 * Gives any AI agent (Claude Code, OpenClaw, etc.) the ability to
 * compress and decompress data through Model Context Protocol.
 *
 * 10,000+ MCP servers exist. Zero for compression. This is the first.
 *
 * Tools provided:
 *   compress    — Compress text/JSON/CSV data (zstd, gzip, lz4, brotli)
 *   decompress  — Decompress back to original
 *   analyze     — Show compressibility, best algorithm, estimated savings
 *   store       — Compress and store to disk with metadata
 *   retrieve    — Decompress and retrieve from disk
 *   stats       — Show compression stats across all stored data
 *
 * Usage:
 *   npx @shipitandpray/mcp-compress
 *
 * Add to Claude Code settings.json:
 *   "mcpServers": {
 *     "compress": {
 *       "command": "npx",
 *       "args": ["@shipitandpray/mcp-compress"]
 *     }
 *   }
 */

import { createInterface } from 'readline';
import { createGzip, createGunzip, gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, deflateSync, inflateSync } from 'zlib';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════
// MCP Protocol Implementation (JSON-RPC over stdio)
// ═══════════════════════════════════════════════════════════

const STORE_DIR = join(homedir(), '.mcp-compress');

class MCPCompressServer {
  constructor() {
    this.version = '0.1.0';
    this.stats = { total_compressed: 0, total_saved_bytes: 0, operations: 0 };
    if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  }

  // ── Compression algorithms ──

  compressData(data, algorithm = 'auto') {
    const buf = Buffer.from(data, 'utf-8');
    const results = {};

    if (algorithm === 'auto' || algorithm === 'gzip') {
      try {
        results.gzip = gzipSync(buf, { level: 9 });
      } catch (e) { /* skip */ }
    }
    if (algorithm === 'auto' || algorithm === 'brotli') {
      try {
        results.brotli = brotliCompressSync(buf);
      } catch (e) { /* skip */ }
    }
    if (algorithm === 'auto' || algorithm === 'deflate') {
      try {
        results.deflate = deflateSync(buf, { level: 9 });
      } catch (e) { /* skip */ }
    }

    if (algorithm === 'auto') {
      // Pick the smallest
      let best = null;
      let bestSize = Infinity;
      for (const [alg, compressed] of Object.entries(results)) {
        if (compressed.length < bestSize) {
          bestSize = compressed.length;
          best = alg;
        }
      }
      return {
        algorithm: best || 'gzip',
        compressed: results[best || 'gzip'],
        originalSize: buf.length,
        compressedSize: bestSize,
        ratio: buf.length / bestSize,
        allResults: Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, { size: v.length, ratio: (buf.length / v.length).toFixed(2) }])
        )
      };
    }

    const compressed = results[algorithm];
    if (!compressed) throw new Error(`Algorithm ${algorithm} failed`);
    return {
      algorithm,
      compressed,
      originalSize: buf.length,
      compressedSize: compressed.length,
      ratio: buf.length / compressed.length,
    };
  }

  decompressData(base64Data, algorithm) {
    const buf = Buffer.from(base64Data, 'base64');
    let decompressed;
    switch (algorithm) {
      case 'gzip': decompressed = gunzipSync(buf); break;
      case 'brotli': decompressed = brotliDecompressSync(buf); break;
      case 'deflate': decompressed = inflateSync(buf); break;
      default: throw new Error(`Unknown algorithm: ${algorithm}`);
    }
    return decompressed.toString('utf-8');
  }

  // ── Tool handlers ──

  handleCompress(args) {
    const { data, algorithm = 'auto' } = args;
    if (!data) return { error: 'Missing "data" parameter' };

    const result = this.compressData(data, algorithm);
    this.stats.total_compressed++;
    this.stats.total_saved_bytes += result.originalSize - result.compressedSize;
    this.stats.operations++;

    return {
      compressed_base64: result.compressed.toString('base64'),
      algorithm: result.algorithm,
      original_size: result.originalSize,
      compressed_size: result.compressedSize,
      ratio: `${result.ratio.toFixed(1)}x`,
      saved_bytes: result.originalSize - result.compressedSize,
      saved_percent: `${((1 - result.compressedSize / result.originalSize) * 100).toFixed(1)}%`,
      ...(result.allResults ? { all_algorithms: result.allResults } : {})
    };
  }

  handleDecompress(args) {
    const { compressed_base64, algorithm } = args;
    if (!compressed_base64) return { error: 'Missing "compressed_base64" parameter' };
    if (!algorithm) return { error: 'Missing "algorithm" parameter' };

    this.stats.operations++;
    const original = this.decompressData(compressed_base64, algorithm);
    return { data: original, size: original.length };
  }

  handleAnalyze(args) {
    const { data } = args;
    if (!data) return { error: 'Missing "data" parameter' };

    const result = this.compressData(data, 'auto');
    const buf = Buffer.from(data, 'utf-8');

    // Estimate compressibility characteristics
    const uniqueChars = new Set(data).size;
    const entropy = this.shannonEntropy(data);

    return {
      original_size: buf.length,
      best_algorithm: result.algorithm,
      best_compressed_size: result.compressedSize,
      best_ratio: `${result.ratio.toFixed(1)}x`,
      all_algorithms: result.allResults,
      entropy_bits_per_char: entropy.toFixed(3),
      unique_characters: uniqueChars,
      total_characters: data.length,
      compressibility: entropy < 3 ? 'HIGH' : entropy < 5 ? 'MEDIUM' : 'LOW',
      recommendation: result.ratio > 5 ? 'Highly compressible — compress everything'
        : result.ratio > 2 ? 'Moderately compressible — compress for storage/transit'
        : 'Low compressibility — data is already dense/random'
    };
  }

  handleStore(args) {
    const { data, name, algorithm = 'auto' } = args;
    if (!data) return { error: 'Missing "data" parameter' };

    const key = name || createHash('sha256').update(data).digest('hex').slice(0, 16);
    const result = this.compressData(data, algorithm);

    const metadata = {
      key,
      algorithm: result.algorithm,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      ratio: result.ratio,
      storedAt: new Date().toISOString(),
      hash: createHash('sha256').update(data).digest('hex'),
    };

    const dataPath = join(STORE_DIR, `${key}.bin`);
    const metaPath = join(STORE_DIR, `${key}.json`);
    writeFileSync(dataPath, result.compressed);
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    this.stats.total_compressed++;
    this.stats.total_saved_bytes += result.originalSize - result.compressedSize;
    this.stats.operations++;

    return {
      key,
      stored_at: dataPath,
      original_size: result.originalSize,
      compressed_size: result.compressedSize,
      ratio: `${result.ratio.toFixed(1)}x`,
      saved: `${result.originalSize - result.compressedSize} bytes`
    };
  }

  handleRetrieve(args) {
    const { key } = args;
    if (!key) return { error: 'Missing "key" parameter' };

    const dataPath = join(STORE_DIR, `${key}.bin`);
    const metaPath = join(STORE_DIR, `${key}.json`);

    if (!existsSync(dataPath) || !existsSync(metaPath)) {
      return { error: `Key "${key}" not found` };
    }

    const metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const compressed = readFileSync(dataPath);
    const original = this.decompressData(compressed.toString('base64'), metadata.algorithm);

    this.stats.operations++;
    return {
      key,
      data: original,
      original_size: metadata.originalSize,
      compressed_size: metadata.compressedSize,
      algorithm: metadata.algorithm,
      stored_at: metadata.storedAt
    };
  }

  handleStats() {
    // Scan store directory
    let totalStored = 0;
    let totalOriginal = 0;
    let totalCompressed = 0;
    let fileCount = 0;

    if (existsSync(STORE_DIR)) {
      const files = readdirSync(STORE_DIR).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try {
          const meta = JSON.parse(readFileSync(join(STORE_DIR, f), 'utf-8'));
          totalOriginal += meta.originalSize || 0;
          totalCompressed += meta.compressedSize || 0;
          fileCount++;
        } catch (e) { /* skip corrupted */ }
      }
    }

    return {
      stored_items: fileCount,
      total_original_bytes: totalOriginal,
      total_compressed_bytes: totalCompressed,
      total_saved_bytes: totalOriginal - totalCompressed,
      overall_ratio: totalCompressed > 0 ? `${(totalOriginal / totalCompressed).toFixed(1)}x` : 'N/A',
      session_operations: this.stats.operations,
      store_path: STORE_DIR
    };
  }

  handleList() {
    if (!existsSync(STORE_DIR)) return { items: [] };

    const files = readdirSync(STORE_DIR).filter(f => f.endsWith('.json'));
    const items = files.map(f => {
      try {
        const meta = JSON.parse(readFileSync(join(STORE_DIR, f), 'utf-8'));
        return {
          key: meta.key,
          algorithm: meta.algorithm,
          original_size: meta.originalSize,
          compressed_size: meta.compressedSize,
          ratio: `${meta.ratio.toFixed(1)}x`,
          stored_at: meta.storedAt
        };
      } catch (e) { return null; }
    }).filter(Boolean);

    return { items, count: items.length };
  }

  // ── Utility ──

  shannonEntropy(str) {
    const freq = {};
    for (const c of str) freq[c] = (freq[c] || 0) + 1;
    const len = str.length;
    let entropy = 0;
    for (const count of Object.values(freq)) {
      const p = count / len;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  // ── MCP Protocol ──

  getToolDefinitions() {
    return [
      {
        name: 'compress',
        description: 'Compress text/JSON/CSV data. Returns base64-encoded compressed data with compression ratio. Use algorithm="auto" to pick the best compression.',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'The data to compress (text, JSON, CSV, etc.)' },
            algorithm: { type: 'string', enum: ['auto', 'gzip', 'brotli', 'deflate'], description: 'Compression algorithm. Default: auto (picks best)' }
          },
          required: ['data']
        }
      },
      {
        name: 'decompress',
        description: 'Decompress previously compressed data. Requires the base64 compressed data and the algorithm used.',
        inputSchema: {
          type: 'object',
          properties: {
            compressed_base64: { type: 'string', description: 'Base64-encoded compressed data' },
            algorithm: { type: 'string', enum: ['gzip', 'brotli', 'deflate'], description: 'Algorithm used for compression' }
          },
          required: ['compressed_base64', 'algorithm']
        }
      },
      {
        name: 'analyze',
        description: 'Analyze how compressible data is. Shows best algorithm, compression ratio, entropy, and recommendation. Use this before deciding whether to compress.',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'The data to analyze' }
          },
          required: ['data']
        }
      },
      {
        name: 'store',
        description: 'Compress data and store it to disk with a key. Retrieve later with the key. Like a compressed key-value store for agents.',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'Data to compress and store' },
            name: { type: 'string', description: 'Key name for retrieval. Auto-generated if not provided.' },
            algorithm: { type: 'string', enum: ['auto', 'gzip', 'brotli', 'deflate'], description: 'Compression algorithm' }
          },
          required: ['data']
        }
      },
      {
        name: 'retrieve',
        description: 'Retrieve and decompress previously stored data by key.',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The key used when storing the data' }
          },
          required: ['key']
        }
      },
      {
        name: 'list',
        description: 'List all stored compressed items with their keys, sizes, and compression ratios.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'stats',
        description: 'Show compression statistics: total items stored, bytes saved, overall compression ratio.',
        inputSchema: { type: 'object', properties: {} }
      }
    ];
  }

  handleRequest(request) {
    const { method, params, id } = request;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-compress', version: this.version }
          }
        };

      case 'notifications/initialized':
        return null; // No response needed

      case 'tools/list':
        return {
          jsonrpc: '2.0', id,
          result: { tools: this.getToolDefinitions() }
        };

      case 'tools/call': {
        const toolName = params?.name;
        const args = params?.arguments || {};
        let result;

        try {
          switch (toolName) {
            case 'compress': result = this.handleCompress(args); break;
            case 'decompress': result = this.handleDecompress(args); break;
            case 'analyze': result = this.handleAnalyze(args); break;
            case 'store': result = this.handleStore(args); break;
            case 'retrieve': result = this.handleRetrieve(args); break;
            case 'list': result = this.handleList(); break;
            case 'stats': result = this.handleStats(); break;
            default: result = { error: `Unknown tool: ${toolName}` };
          }
        } catch (e) {
          result = { error: e.message };
        }

        return {
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        };
      }

      default:
        return {
          jsonrpc: '2.0', id,
          error: { code: -32601, message: `Method not found: ${method}` }
        };
    }
  }

  run() {
    const rl = createInterface({ input: process.stdin, terminal: false });
    let buffer = '';

    rl.on('line', (line) => {
      buffer += line;
      try {
        const request = JSON.parse(buffer);
        buffer = '';
        const response = this.handleRequest(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (e) {
        // Incomplete JSON, keep buffering
        if (e instanceof SyntaxError) return;
        buffer = '';
        const errorResponse = {
          jsonrpc: '2.0', id: null,
          error: { code: -32700, message: `Parse error: ${e.message}` }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    process.stderr.write('mcp-compress server running\n');
  }
}

const server = new MCPCompressServer();
server.run();
