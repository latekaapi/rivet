#!/usr/bin/env node
// Design Token Lint — validates DESIGN.md frontmatter + body structure, and
// lints given frontend files against the DESIGN.md token registry.
//
// Two modes:
//   --validate-spec <path>                    validate a DESIGN.md's frontmatter + required sections
//   --design <path> --files <csv-of-paths>    lint given files against the given design spec
//
// Exit codes:
//   0  clean
//   1  spec validation failed
//   2  lint violations, or input file missing
//   3  internal error (e.g., impeccable parser unavailable)

import { homedir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const IMPECCABLE_DIR = process.env.IMPECCABLE_DIR || join(homedir(), '.agents/skills/impeccable');
const IMPECCABLE_PARSER = join(IMPECCABLE_DIR, 'scripts/design-parser.mjs');

async function loadParser() {
  if (!existsSync(IMPECCABLE_PARSER)) {
    console.error(`design-lint: impeccable design-parser.mjs not found at ${IMPECCABLE_PARSER}`);
    console.error('Install impeccable (https://github.com/pbakaus/impeccable), or set IMPECCABLE_DIR to its install path.');
    process.exit(3);
  }
  return import(IMPECCABLE_PARSER);
}

function parseArgs(argv) {
  const args = { mode: null, path: null, files: [], design: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--validate-spec') { args.mode = 'validate'; args.path = argv[++i]; }
    else if (a === '--design') { args.design = argv[++i]; }
    else if (a === '--files') { args.files = argv[++i].split(',').map(s => s.trim()).filter(Boolean); }
  }
  if (!args.mode && args.design && args.files.length) args.mode = 'lint';
  return args;
}

function buildRegistry(model) {
  const colors = new Set();
  const spacings = new Set();
  const radii = new Set();
  const fontFamilies = new Set();
  const fontSizes = new Set();
  const fm = model.frontmatter || {};

  const addStringValues = (obj, set) => {
    if (!obj || typeof obj !== 'object') return;
    for (const v of Object.values(obj)) if (typeof v === 'string') set.add(v.trim().toLowerCase());
  };

  addStringValues(fm.colors, colors);
  addStringValues(fm.spacing, spacings);
  addStringValues(fm.rounded, radii);

  if (fm.typography && typeof fm.typography === 'object') {
    for (const role of Object.values(fm.typography)) {
      if (!role || typeof role !== 'object') continue;
      if (typeof role.fontFamily === 'string') fontFamilies.add(role.fontFamily.trim().toLowerCase());
      if (typeof role.fontSize === 'string') fontSizes.add(role.fontSize.trim().toLowerCase());
    }
  }

  return { colors, spacings, radii, fontFamilies, fontSizes };
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const OKLCH_RE = /oklch\([^)]+\)/gi;
const PX_RE = /\b\d+(?:\.\d+)?px\b/g;
const REM_RE = /\b\d+(?:\.\d+)?rem\b/g;
const FF_RE = /(?:font-family|fontFamily)\s*:\s*([^;,\n}]+)/gi;

function normalizeSpaces(s) { return s.replace(/\s+/g, ' ').trim().toLowerCase(); }

function isAllowedLength(hit, registry) {
  const lower = hit.toLowerCase();
  return registry.spacings.has(lower) || registry.radii.has(lower) || registry.fontSizes.has(lower);
}

function lintFile(filePath, registry) {
  const violations = [];
  if (!existsSync(filePath)) return violations;
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    // Strip comments to reduce false positives. Conservative — only strip // and /* */ patterns.
    const line = rawLine
      .replace(/\/\/.*$/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const excerpt = rawLine.trim().slice(0, 120);

    for (const m of line.matchAll(HEX_RE)) {
      const hit = m[0].toLowerCase();
      if (!registry.colors.has(hit)) {
        violations.push({ file: filePath, line: lineNo, kind: 'color.hex', value: m[0], excerpt });
      }
    }

    for (const m of line.matchAll(OKLCH_RE)) {
      const norm = normalizeSpaces(m[0]);
      const allowed = [...registry.colors].some(c => normalizeSpaces(c) === norm);
      if (!allowed) {
        violations.push({ file: filePath, line: lineNo, kind: 'color.oklch', value: m[0], excerpt });
      }
    }

    for (const m of line.matchAll(PX_RE)) {
      const hit = m[0];
      // Skip 0px and 1px — too commonly used for borders and reset and rarely tokenized.
      if (hit === '0px' || hit === '1px') continue;
      if (!isAllowedLength(hit, registry)) {
        violations.push({ file: filePath, line: lineNo, kind: 'length.px', value: hit, excerpt });
      }
    }

    for (const m of line.matchAll(REM_RE)) {
      const hit = m[0];
      if (!isAllowedLength(hit, registry)) {
        violations.push({ file: filePath, line: lineNo, kind: 'length.rem', value: hit, excerpt });
      }
    }

    for (const m of line.matchAll(FF_RE)) {
      const family = m[1].trim().replace(/['"]/g, '').toLowerCase();
      const firstFont = family.split(',')[0].trim();
      let allowed = false;
      for (const entry of registry.fontFamilies) {
        const norm = entry.replace(/['"]/g, '').toLowerCase();
        if (norm === family || norm.startsWith(firstFont)) { allowed = true; break; }
      }
      if (!allowed && family && firstFont !== 'inherit' && firstFont !== 'initial') {
        violations.push({ file: filePath, line: lineNo, kind: 'typography.fontFamily', value: m[0].trim(), excerpt });
      }
    }
  });

  return violations;
}

function suggestClosest(violation, registry) {
  if (violation.kind.startsWith('length.')) {
    const n = parseFloat(violation.value);
    let best = null;
    let bestDiff = Infinity;
    for (const allowed of [...registry.spacings, ...registry.radii, ...registry.fontSizes]) {
      const an = parseFloat(allowed);
      if (!Number.isFinite(an)) continue;
      const diff = Math.abs(an - n);
      if (diff < bestDiff) { bestDiff = diff; best = allowed; }
    }
    return best;
  }
  return null;
}

async function runValidate(path) {
  if (!path) { console.error('design-lint: --validate-spec requires a path'); process.exit(2); }
  if (!existsSync(path)) { console.error(`design-lint: DESIGN.md not found at ${path}`); process.exit(2); }

  const { parseDesignMd } = await loadParser();
  const model = parseDesignMd(readFileSync(path, 'utf-8'));

  const issues = [];
  if (!model.frontmatter) {
    issues.push('Missing YAML frontmatter — DESIGN.md must open with a --- block containing tokens');
  } else {
    const fm = model.frontmatter;
    if (!fm.colors || Object.keys(fm.colors).length === 0) {
      issues.push('frontmatter.colors is empty or missing — define at least one color token');
    }
    if (!fm.typography || Object.keys(fm.typography).length === 0) {
      issues.push('frontmatter.typography is empty or missing — define at least one typography role');
    }
  }

  const sectionChecks = [
    ['overview', 'Overview'],
    ['colors', 'Colors'],
    ['typography', 'Typography'],
    ['elevation', 'Elevation'],
    ['components', 'Components'],
    ['dosDonts', "Do's and Don'ts"],
  ];
  for (const [key, label] of sectionChecks) {
    const val = model[key];
    const isEmpty =
      val == null ||
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0);
    if (isEmpty) issues.push(`Missing or empty markdown section: ${label}`);
  }

  if (issues.length === 0) {
    console.log(`✓ ${path} valid`);
    process.exit(0);
  }
  console.error(`✗ ${path} has ${issues.length} issue(s):`);
  for (const i of issues) console.error(`  - ${i}`);
  process.exit(1);
}

async function runLint({ design, files }) {
  if (!design) { console.error('design-lint: --design <path> required for lint mode'); process.exit(2); }
  if (!existsSync(design)) { console.error(`design-lint: design spec not found at ${design}`); process.exit(2); }

  const { parseDesignMd } = await loadParser();
  const model = parseDesignMd(readFileSync(design, 'utf-8'));
  if (!model.frontmatter) {
    console.error(`design-lint: ${design} has no YAML frontmatter — cannot build token registry`);
    console.error('Run: node design-lint.mjs --validate-spec ' + design);
    process.exit(2);
  }
  const registry = buildRegistry(model);

  const allViolations = [];
  for (const file of files) {
    const abs = resolve(file);
    allViolations.push(...lintFile(abs, registry));
  }

  if (allViolations.length === 0) {
    const n = files.length;
    console.log(`Design Token Lint clean (${n} file${n === 1 ? '' : 's'}, spec: ${design})`);
    process.exit(0);
  }

  console.error(`Design Token Lint — ${allViolations.length} violation(s) against ${design}`);
  console.error('');
  for (const v of allViolations) {
    const hint = suggestClosest(v, registry);
    const hintStr = hint ? ` — closest allowed: ${hint}` : '';
    console.error(`  ${v.file}:${v.line}  [${v.kind}] ${v.value}${hintStr}`);
    console.error(`    ${v.excerpt}`);
  }
  process.exit(2);
}

function usage() {
  console.error('design-lint: usage');
  console.error('  node design-lint.mjs --validate-spec <path-to-DESIGN.md>');
  console.error('  node design-lint.mjs --design <path-to-DESIGN.md> --files <comma-separated-paths>');
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.mode === 'validate') return runValidate(args.path);
  if (args.mode === 'lint') return runLint(args);
  usage();
}

main().catch(err => {
  console.error('design-lint: unexpected error');
  console.error(err?.stack || err);
  process.exit(3);
});
