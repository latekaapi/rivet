#!/usr/bin/env node
// Trigram similarity for component names + purposes.
// Used by Stage 2a step 4 in run.md to classify new_primitive declarations
// against existing catalog entries without always reaching for the LLM.
//
// Algorithm: character trigrams (lowercased, whitespace-stripped), Jaccard
// on the sets, weighted name (0.7) + purpose (0.3).
//
// CLI for testing:
//   node similarity.mjs --a-name <str> --a-purpose <str> --b-name <str> --b-purpose <str>
//
// Programmatic:
//   import { similarity, trigrams } from './similarity.mjs'
//   similarity({ name: 'PricingCard', purpose: 'tier plan display' }, { name: 'PricingPlanCard', purpose: 'plan tier display' })

export function trigrams(s) {
  const norm = String(s ?? '').toLowerCase().replace(/\s+/g, '');
  if (norm.length < 3) {
    // For very short strings, use the whole string as one gram so same/same matches.
    return norm ? new Set([norm]) : new Set();
  }
  const set = new Set();
  for (let i = 0; i <= norm.length - 3; i++) set.add(norm.slice(i, i + 3));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function similarity(a, b) {
  const nameScore = jaccard(trigrams(a.name), trigrams(b.name));
  const purposeScore = jaccard(trigrams(a.purpose), trigrams(b.purpose));
  return 0.7 * nameScore + 0.3 * purposeScore;
}

export function classify(score) {
  if (score >= 0.80) return 'auto-flag';
  if (score <= 0.35) return 'auto-pass';
  return 'gray-zone';
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
  }
  return args;
}

function cli() {
  const args = parseArgs(process.argv);
  const a = { name: args['a-name'] || '', purpose: args['a-purpose'] || '' };
  const b = { name: args['b-name'] || '', purpose: args['b-purpose'] || '' };
  if (!a.name && !b.name) {
    console.error('similarity: usage');
    console.error('  node similarity.mjs --a-name X --a-purpose "..." --b-name Y --b-purpose "..."');
    process.exit(2);
  }
  const score = similarity(a, b);
  const band = classify(score);
  console.log(JSON.stringify({ score: Number(score.toFixed(4)), classification: band, a, b }, null, 2));
}

const running = process.argv[1];
if (running?.endsWith('similarity.mjs')) cli();
