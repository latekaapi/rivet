// SMOKE-TEST STUB. Stand-in for impeccable's design-parser.mjs so
// scripts/test-integration.sh can run without impeccable installed.
//
// scripts/test-integration.sh exports IMPECCABLE_DIR=<repo>/scripts/test-fixtures/impeccable
// before invoking design-lint.mjs, which then loads THIS file as the parser.
//
// Implements only the surface design-lint.mjs depends on:
//   - parseDesignMd(md) → { schemaVersion, frontmatter, overview, colors, typography,
//                           elevation, components, dosDonts, ... }
//   - frontmatter is a real YAML-subset parse (one or two levels of nesting,
//     scalar string values; matches the test-integration.sh DESIGN.md fixture shape)
//   - body sections are detected via `## Heading` regex; presence is enough for the
//     validate-spec checks. Real content extraction is left to the real parser.
//
// The real impeccable parser (full grammar, much more) lives at
//   https://github.com/pbakaus/impeccable
// Do NOT import this stub from production code.

export function parseDesignMd(md) {
  const fmMatch = md.match(/^---\s*\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? parseYamlSubset(fmMatch[1]) : null;
  const body = fmMatch ? md.slice(fmMatch[0].length) : md;

  return {
    schemaVersion: 1,
    title: extractTitle(body),
    frontmatter,
    overview: hasSection(body, 'Overview'),
    colors: hasSection(body, 'Colors'),
    typography: hasSection(body, 'Typography'),
    elevation: hasSection(body, 'Elevation'),
    components: hasSection(body, 'Components'),
    dosDonts: hasSection(body, "Do's and Don'ts"),
  };
}

// Bare-minimum YAML subset: `key: value` (scalars, optional quotes) and
// `key:` openers introducing nested blocks indented deeper. Two levels of nesting
// is enough for the typography → role → {fontFamily, fontSize} shape we need.
function parseYamlSubset(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^(\s*)([^:\s][^:]*?):\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const key = m[2].trim();
    const rest = m[3].trim();
    while (stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (rest === '') {
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
    } else {
      parent[key] = stripQuotes(rest);
    }
  }
  return root;
}

function stripQuotes(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function extractTitle(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1] : null;
}

function hasSection(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  return re.test(body) ? { found: true } : null;
}
