import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const contractsDir = path.join(import.meta.dir);
const packageRoot = path.resolve(contractsDir, "../..");
const srcRoot = path.join(packageRoot, "src");

/** Approved `@khoralabs/relay/*` specs → source files under this package. */
const PACKAGE_SUBPATHS: Record<string, string> = {
  "@khoralabs/relay/crypto/encoding": path.join(srcRoot, "crypto/encoding.ts"),
  "@khoralabs/relay/crypto": path.join(srcRoot, "crypto/index.ts"),
  "@khoralabs/relay/contracts": path.join(srcRoot, "contracts/index.ts"),
  "@khoralabs/relay/contracts/http": path.join(srcRoot, "contracts/http.ts"),
  "@khoralabs/relay/contracts/errors": path.join(srcRoot, "contracts/errors.ts"),
};

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".test.ts")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@khoralabs/relay/")) {
    const mapped = PACKAGE_SUBPATHS[spec];
    if (mapped === undefined) {
      throw new Error(
        `unapproved package import ${JSON.stringify(spec)} from ${path.relative(packageRoot, fromFile)}`,
      );
    }
    return mapped;
  }
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `unresolved relative import ${JSON.stringify(spec)} from ${path.relative(packageRoot, fromFile)}`,
  );
}

/** Value import/export specs (skips `import type` / `export type`), multiline-safe. */
function collectValueImportSpecs(text: string): string[] {
  const specs: string[] = [];
  const re = /(?:^|\n)[ \t]*(?:export|import)(?!\s+type\b)[\s\S]*?\bfrom\s+["']([^"']+)["']/g;
  for (const match of text.matchAll(re)) {
    const spec = match[1];
    if (spec !== undefined) specs.push(spec);
  }
  return specs;
}

function collectImportSpecs(file: string): string[] {
  return collectValueImportSpecs(readFileSync(file, "utf8"));
}

/** BFS value-import graph from entry; skips type-only imports. */
function reachableFiles(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const spec of collectValueImportSpecs(text)) {
      const resolved = resolveImport(file, spec);
      if (resolved !== null && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

describe("contracts client/server boundary", () => {
  test("./contracts value graph excludes pairing-secret-cipher and node:crypto", () => {
    const entry = path.join(contractsDir, "index.ts");
    const files = reachableFiles(entry);
    const rel = [...files].map((f) => path.relative(packageRoot, f));
    expect(rel.some((f) => f.includes("pairing-secret-cipher"))).toBe(false);
    expect(rel.some((f) => f.includes("pairing-secret-key"))).toBe(false);
    expect(rel.some((f) => f.endsWith("crypto/index.ts"))).toBe(false);

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("node:crypto")).toBe(false);
      expect(text.includes('from "node:fs')).toBe(false);
    }
  });

  test("contracts sources do not import @khoralabs/relay/crypto barrel", () => {
    for (const file of collectTsFiles(contractsDir)) {
      for (const spec of collectImportSpecs(file)) {
        expect(spec).not.toBe("@khoralabs/relay/crypto");
      }
    }
  });
});
