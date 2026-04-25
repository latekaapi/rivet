#!/usr/bin/env node
// Verifies that every declared `reuse:` entry in a task was actually imported
// or referenced in at least one changed file. Catches the silent failure
// where an executor declares reuse but then doesn't use the primitive.
//
// Resolution is import-aware (not grep):
// - expands tsconfig.json / jsconfig.json paths aliases
// - resolves relative imports against each file's directory
// - matches barrel re-exports via the imported identifier
// - catches JSX tag usage and function-call usage in the file body
//
// CLI:
//   node check-reuse.mjs \
//     --reuse "@/components/ui/Button,@/components/marketing/SectionHeading" \
//     --files "src/pages/pricing.tsx,src/components/pricing/Card.tsx" \
//     [--root .]
//
// Identifier convention: by default, derived from the last non-index segment
// of the reuse path. To be explicit, use `path|Identifier` (e.g.,
// `@/components/ui/Button|PrimaryButton`).
//
// Exit codes:
//   0  all declared reuses were used
//   2  one or more declared reuses unused, or input error
//   3  internal error

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename, extname, relative, isAbsolute, posix } from 'node:path';

function parseArgs(argv) {
  const args = { reuse: [], files: [], root: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reuse') args.reuse = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--files') args.files = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--root') args.root = argv[++i];
  }
  return args;
}

// Parse a `path|Identifier` or `path` into { path, identifier }.
// Identifier defaults to the basename of `path`, stripping extensions and index segments.
function parseReuseEntry(entry) {
  const [path, identOverride] = entry.split('|').map(s => s.trim());
  let identifier = identOverride;
  if (!identifier) {
    let base = path.replace(/\.[^./]+$/, '');                  // strip trailing extension if any
    base = base.replace(/\/index$/, '');                       // strip trailing /index
    identifier = basename(base);
  }
  return { path, identifier };
}

// Load tsconfig-style paths aliases. Returns { baseUrl, paths }. Either may be null.
function loadAliases(root) {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    try {
      // Strip trailing commas + line-comments so strict JSON.parse works on common tsconfigs.
      const raw = readFileSync(p, 'utf-8')
        .replace(/\/\/[^\n\r]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,(\s*[}\]])/g, '$1');
      const parsed = JSON.parse(raw);
      const co = parsed?.compilerOptions || {};
      return { baseUrl: co.baseUrl || '.', paths: co.paths || {} };
    } catch {
      // ignore broken config; fall back to no aliases
    }
  }
  return { baseUrl: null, paths: {} };
}

// Resolve an import specifier to a repo-relative path (without trying extensions —
// we compare by prefix so extension variation doesn't matter).
function resolveImport(spec, importerFile, root, aliases) {
  if (!spec) return null;

  // Relative import (./foo, ../foo)
  if (spec.startsWith('.')) {
    const abs = resolve(dirname(importerFile), spec);
    return toRepoRelative(abs, root);
  }

  // Alias (e.g. @/foo → <baseUrl>/foo or matched paths entry)
  if (aliases.paths) {
    for (const pattern of Object.keys(aliases.paths)) {
      const match = matchAliasPattern(pattern, spec);
      if (match !== null) {
        const targets = aliases.paths[pattern];
        const target = Array.isArray(targets) ? targets[0] : targets;
        const resolved = target.replace('*', match);
        const base = aliases.baseUrl ? resolve(root, aliases.baseUrl) : root;
        const abs = resolve(base, resolved);
        return toRepoRelative(abs, root);
      }
    }
  }

  // Bare module (node_modules) — return the spec itself so literal-path matching still works.
  return spec;
}

function matchAliasPattern(pattern, spec) {
  const starIdx = pattern.indexOf('*');
  if (starIdx === -1) {
    return pattern === spec ? '' : null;
  }
  const prefix = pattern.slice(0, starIdx);
  const suffix = pattern.slice(starIdx + 1);
  if (!spec.startsWith(prefix) || !spec.endsWith(suffix)) return null;
  return spec.slice(prefix.length, spec.length - suffix.length);
}

function toRepoRelative(abs, root) {
  const rel = relative(root, abs);
  // Strip extension + trailing /index for path comparison
  let stripped = rel.replace(/\.[^./]+$/, '').replace(/\/index$/, '');
  return stripped.split(/[\\/]/).join(posix.sep);
}

// Normalize a reuse path the same way we normalize imports, so `@/components/ui/Button.tsx`
// and `@/components/ui/Button` compare equal.
function normalizeReusePath(reusePath, root, aliases) {
  const resolved = resolveImport(reusePath, join(root, '__noop'), root, aliases);
  return resolved;
}

// Extract all import specifiers from a file's content. Returns an array of
// { spec, identifiers } entries — identifiers is the list of names pulled
// from the import (useful for barrel-match).
function extractImports(content) {
  const out = [];

  // Static imports: `import ... from "spec"`
  const staticRe = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = staticRe.exec(content)) !== null) {
    out.push({ spec: m[2], identifiers: parseImportClause(m[1]) });
  }

  // Side-effect imports: `import "spec"`
  const sideRe = /import\s+['"]([^'"]+)['"]/g;
  while ((m = sideRe.exec(content)) !== null) {
    out.push({ spec: m[1], identifiers: [] });
  }

  // Dynamic imports: `import("spec")`
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(content)) !== null) {
    out.push({ spec: m[1], identifiers: [] });
  }

  // require(...) — primarily for .cjs / older codebases
  const reqRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe.exec(content)) !== null) {
    out.push({ spec: m[1], identifiers: [] });
  }

  return out;
}

// Parse an import clause like `X`, `{ X, Y as Z }`, `X, { Y }`, `* as X` into an
// array of identifiers. We keep both the local name (after `as`) and the origin
// name to be permissive when matching.
function parseImportClause(clause) {
  const out = new Set();
  if (!clause) return [];
  const cleaned = clause.trim();

  // Default import
  const defaultMatch = cleaned.match(/^([A-Za-z_$][\w$]*)/);
  if (defaultMatch) out.add(defaultMatch[1]);

  // Namespace import
  const nsMatch = cleaned.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (nsMatch) out.add(nsMatch[1]);

  // Named imports inside { ... }
  const bracesMatch = cleaned.match(/\{([^}]*)\}/);
  if (bracesMatch) {
    const names = bracesMatch[1].split(',');
    for (const n of names) {
      const trimmed = n.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+as\s+/);
      for (const p of parts) {
        const clean = p.trim().replace(/^type\s+/, '');
        if (/^[A-Za-z_$][\w$]*$/.test(clean)) out.add(clean);
      }
    }
  }

  return [...out];
}

// Check whether an identifier is used as a JSX tag or called as a function
// anywhere in the file body (outside import statements).
function usesIdentifier(content, identifier) {
  if (!identifier) return false;
  const esc = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRe = new RegExp(`<\\s*${esc}(\\s|>|/|\\.)`);
  const callRe = new RegExp(`\\b${esc}\\s*\\(`);
  return tagRe.test(content) || callRe.test(content);
}

// Check whether a declared reuse entry was used in any of the changed files.
function isUsed(entry, normalizedReuse, files, root, aliases) {
  const { path: reusePath, identifier } = entry;
  for (const file of files) {
    const abs = isAbsolute(file) ? file : resolve(root, file);
    if (!existsSync(abs)) continue;
    let content;
    try { content = readFileSync(abs, 'utf-8'); } catch { continue; }

    const imports = extractImports(content);

    for (const imp of imports) {
      // Direct path match — import resolves to the same repo-relative path as the reuse entry.
      const resolved = resolveImport(imp.spec, abs, root, aliases);
      if (resolved && normalizedReuse && resolved === normalizedReuse) return { file, how: 'path' };

      // Barrel match — import specifier list includes the declared identifier.
      if (imp.identifiers.includes(identifier)) return { file, how: 'barrel' };

      // Literal string match on the bare spec (covers bare-module reuse paths).
      if (imp.spec === reusePath) return { file, how: 'literal' };
    }

    // Identifier used in body (JSX tag or function call) without import — rare but possible
    // for globals or module-augmented identifiers.
    if (usesIdentifier(content, identifier)) return { file, how: 'body-usage' };
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.reuse.length) {
    console.log('check-reuse: no --reuse entries provided; nothing to check (exit 0)');
    process.exit(0);
  }
  if (!args.files.length) {
    console.error('check-reuse: --files is required (comma-separated changed-file list)');
    process.exit(2);
  }

  const root = resolve(args.root);
  const aliases = loadAliases(root);

  const results = [];
  for (const raw of args.reuse) {
    const entry = parseReuseEntry(raw);
    const normalized = normalizeReusePath(entry.path, root, aliases);
    const used = isUsed(entry, normalized, args.files, root, aliases);
    results.push({ entry, used, normalized });
  }

  const unused = results.filter(r => !r.used);
  if (unused.length === 0) {
    console.log(`check-reuse: all ${results.length} declared reuse${results.length === 1 ? '' : 's'} were used`);
    process.exit(0);
  }

  console.error(`check-reuse: ${unused.length} declared reuse${unused.length === 1 ? '' : 's'} unused`);
  console.error('');
  for (const r of unused) {
    console.error(`  ✗ ${r.entry.path}  (expected identifier: ${r.entry.identifier})`);
    console.error(`    Task declared reuse of this primitive but no changed file imports it,`);
    console.error(`    references it as a JSX tag, or calls it. Either import it, update the`);
    console.error(`    reuse declaration to match actual usage, or justify a new_primitive.`);
  }
  process.exit(2);
}

try { main(); } catch (err) {
  console.error('check-reuse: unexpected error');
  console.error(err?.stack || err);
  process.exit(3);
}
