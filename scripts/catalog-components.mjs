#!/usr/bin/env node
// Component Catalog — scans frontend component directories and emits a
// per-phase catalog grouped by surface (matched via PRODUCT.md's ## Surfaces).
//
// Usage:
//   node catalog-components.mjs --out <path> [--product <path>] [--root <repo>] [--roots <csv>]
//
// Component-root resolution order:
//   1. --roots CLI flag (comma-separated paths relative to --root)
//   2. rivet.config.json { "componentRoots": [...] } at --root
//   3. Auto-detect: always scans src/components, src/lib/components, components, app/components;
//      also scans resources/js/* and resources/views/components if composer.json or resources/js/ exists.
//
// Exit codes:
//   0  catalog written
//   2  usage / input error

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve, basename, extname } from 'node:path';

const BASE_COMPONENT_ROOTS = [
  'src/components',
  'src/lib/components',
  'components',
  'app/components',
];

const LARAVEL_COMPONENT_ROOTS = [
  'resources/js/components',
  'resources/js/Components',
  'resources/js/Pages',
  'resources/views/components',
];

const SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', '.next', '.output', 'coverage', 'storybook-static']);
const COMPONENT_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.astro']);
const BLADE_SUFFIX = '.blade.php';

function parseArgs(argv) {
  const args = { out: null, product: 'PRODUCT.md', root: process.cwd(), roots: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--product') args.product = argv[++i];
    else if (a === '--root') args.root = argv[++i];
    else if (a === '--roots') args.roots = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
  }
  return args;
}

function resolveComponentRoots(cliRoots, root) {
  if (cliRoots && cliRoots.length) return cliRoots;

  const cfgPath = join(root, 'rivet.config.json');
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
      if (Array.isArray(cfg.componentRoots) && cfg.componentRoots.length) return cfg.componentRoots;
    } catch { /* invalid config — fall through to auto-detect */ }
  }

  const hasLaravel = existsSync(join(root, 'composer.json')) || existsSync(join(root, 'resources/js'));
  return hasLaravel ? [...BASE_COMPONENT_ROOTS, ...LARAVEL_COMPONENT_ROOTS] : BASE_COMPONENT_ROOTS;
}

// Parse PRODUCT.md's ## Surfaces section. Format:
//   ## Surfaces
//   - name: admin
//     route: /admin/**, app/admin/**
//     register: product
//     design_ref: DESIGN-admin.md
function parseSurfaces(productMdPath) {
  if (!existsSync(productMdPath)) return [];
  const md = readFileSync(productMdPath, 'utf-8');
  const header = md.match(/^##\s+Surfaces\s*$/m);
  if (!header) return [];
  const afterHeader = md.slice(header.index + header[0].length);
  const nextHeader = afterHeader.match(/^##\s+\S/m);
  const section = nextHeader ? afterHeader.slice(0, nextHeader.index) : afterHeader;

  const starts = [];
  const itemRe = /^-\s+name:\s+(\S+)\s*$/gm;
  let m;
  while ((m = itemRe.exec(section)) !== null) {
    starts.push({ name: m[1], idx: m.index });
  }

  const surfaces = [];
  for (let i = 0; i < starts.length; i++) {
    const begin = starts[i].idx;
    const end = i + 1 < starts.length ? starts[i + 1].idx : section.length;
    const block = section.slice(begin, end);
    const routeMatch = block.match(/^\s+route:\s+(.+)$/m);
    const registerMatch = block.match(/^\s+register:\s+(\S+)/m);
    const designRefMatch = block.match(/^\s+design_ref:\s+(\S+)/m);
    const routes = routeMatch
      ? routeMatch[1].split(',').map(r => r.replace(/#.*$/, '').trim()).filter(Boolean)
      : [];
    surfaces.push({
      name: starts[i].name,
      routes,
      register: registerMatch ? registerMatch[1] : 'product',
      design_ref: designRefMatch ? designRefMatch[1] : 'DESIGN.md',
    });
  }
  return surfaces;
}

// Reduce a route glob to a recognizable path segment, e.g. "/admin/**" -> "admin".
// Used for loose substring matching against file paths.
function routeToPathHint(route) {
  return route
    .replace(/^\/+/, '')
    .replace(/\*+.*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function surfaceForFile(relPath, surfaces) {
  const p = relPath.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const s of surfaces) {
    for (const route of s.routes) {
      const hint = routeToPathHint(route);
      if (!hint) continue;
      if (p.includes(hint) && hint.length > bestLen) {
        bestLen = hint.length;
        best = s.name;
      }
    }
  }
  return best;
}

function walk(dir, acc) {
  if (!existsSync(dir)) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, acc);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (COMPONENT_EXTS.has(ext) || entry.name.endsWith(BLADE_SUFFIX)) {
        acc.push(p);
      }
    }
  }
}

function extractInfo(absPath, root) {
  const rel = relative(root, absPath);
  const base = basename(absPath);
  const name = base.replace(/\.blade\.php$|\.[^.]+$/, '');

  let purpose = '';
  try {
    const content = readFileSync(absPath, 'utf-8').slice(0, 2000);
    // Leading JSDoc: /** ... */
    const doc = content.match(/^\s*\/\*\*\s*\n([\s\S]*?)\*\//);
    if (doc) {
      const firstLine = doc[1]
        .split('\n')
        .map(l => l.replace(/^\s*\*\s?/, '').trim())
        .find(l => l.length && !l.startsWith('@'));
      if (firstLine) purpose = firstLine.slice(0, 140);
    }
    if (!purpose) {
      // Leading single-line comment
      const lc = content.match(/^\s*\/\/\s*(.+)/);
      if (lc) purpose = lc[1].trim().slice(0, 140);
    }
  } catch { /* unreadable file — skip purpose */ }
  return { name, path: rel, purpose };
}

function buildCatalog(components, surfaces) {
  const bySurface = new Map();
  for (const c of components) {
    const s = surfaceForFile(c.path, surfaces) || 'default';
    if (!bySurface.has(s)) bySurface.set(s, []);
    bySurface.get(s).push(c);
  }
  return bySurface;
}

function writeCatalog(outPath, bySurface, surfaces) {
  const lines = [];
  lines.push('# Component Catalog');
  lines.push('');
  lines.push('Auto-generated by `/rivet plan` (scripts/catalog-components.mjs). Existing UI primitives, grouped by surface.');
  lines.push('');
  lines.push('Edit this file before proceeding: tighten purpose descriptions, mark deprecated items, or change `active` to `do-not-reuse`. `/rivet plan` reads this catalog to enforce reuse-vs-new decisions in task specs.');
  lines.push('');

  const surfaceNames = [...bySurface.keys()].sort((a, b) => {
    if (a === 'default') return 1;
    if (b === 'default') return -1;
    return a.localeCompare(b);
  });

  if (surfaceNames.length === 0) {
    lines.push('_(no components found — this project has no frontend primitives yet)_');
  }

  for (const name of surfaceNames) {
    const list = bySurface.get(name).sort((a, b) => a.name.localeCompare(b.name));
    const surfaceMeta = surfaces.find(s => s.name === name);
    lines.push(`## Surface: ${name}`);
    if (surfaceMeta) {
      lines.push('');
      lines.push(`Register: ${surfaceMeta.register}  ·  design_ref: ${surfaceMeta.design_ref}`);
    }
    lines.push('');

    if (list.length === 0) {
      lines.push('_(no components found)_');
      lines.push('');
      continue;
    }

    lines.push('| Component | Path | Status | Purpose |');
    lines.push('|---|---|---|---|');
    for (const c of list) {
      const purpose = (c.purpose || '—').replace(/\|/g, '\\|');
      lines.push(`| ${c.name} | \`${c.path}\` | active | ${purpose} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**Status legend:**');
  lines.push('- `active` — reusable; planner may reference in task specs');
  lines.push('- `deprecated` — existing but being phased out; prefer new primitive');
  lines.push('- `do-not-reuse` — exists but not intended for reuse in new work');
  lines.push('- `do-not-merge` — exists AND is reusable, but similarity checks should NOT flag new primitives as duplicates of this entry. Use for legitimately-distinct components with unavoidably similar names (e.g., `PricingCard` vs `PricingPlanCard`).');

  writeFileSync(outPath, lines.join('\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.out) {
    console.error('catalog-components: usage');
    console.error('  node catalog-components.mjs --out <path> [--product PRODUCT.md] [--root .]');
    process.exit(2);
  }

  const root = resolve(args.root);
  const productPath = resolve(root, args.product);
  const surfaces = parseSurfaces(productPath);

  const roots = resolveComponentRoots(args.roots, root);
  const candidates = [];
  for (const dir of roots) walk(join(root, dir), candidates);

  const seen = new Set();
  const unique = [];
  for (const p of candidates) if (!seen.has(p)) { seen.add(p); unique.push(p); }

  const components = unique.map(p => extractInfo(p, root));
  const bySurface = buildCatalog(components, surfaces);
  writeCatalog(resolve(args.out), bySurface, surfaces);

  const total = components.length;
  const surfaceCount = bySurface.size;
  console.log(
    `catalog-components: wrote ${total} component${total === 1 ? '' : 's'} across ${surfaceCount} surface${surfaceCount === 1 ? '' : 's'} → ${args.out}`
  );
}

main();
