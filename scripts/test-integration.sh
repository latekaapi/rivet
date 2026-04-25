#!/usr/bin/env bash
# Script-level smoke test for the /rivet skill's design-integration helpers.
# Exercises design-lint, catalog-components, check-reuse, similarity against
# self-contained fixtures. Runs in under 30 seconds.
#
# Usage:
#   bash ~/.claude/skills/rivet/scripts/test-integration.sh
#
# Exit codes:
#   0  all steps PASS
#   1  one or more steps FAIL

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Point design-lint.mjs at the vendored stub design-parser.mjs so the smoke test
# is self-contained (no impeccable install required). See scripts/test-fixtures/
# impeccable/scripts/design-parser.mjs for the stub.
export IMPECCABLE_DIR="$SCRIPT_DIR/test-fixtures/impeccable"

PASS=0
FAIL=0
FAILED_STEPS=()

step() {
  local name="$1"
  local status="$2"
  local reason="${3:-}"
  if [[ "$status" == "pass" ]]; then
    echo "PASS: $name"
    PASS=$((PASS+1))
  else
    echo "FAIL: $name${reason:+ — $reason}"
    FAIL=$((FAIL+1))
    FAILED_STEPS+=("$name")
  fi
}

TMP=$(mktemp -d "${TMPDIR:-/tmp}/rivet-skill-test.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

# ---------- Fixture: valid DESIGN.md ----------
cat > "$TMP/DESIGN.md" <<'EOF'
---
name: Fixture
description: smoke-test spec
colors:
  primary: "#b8422e"
  neutral-bg: "#faf7f2"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
  heading:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "32px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
rounded:
  sm: "4px"
  md: "8px"
---

## Overview
Fixture for smoke tests.

## Colors
- primary: #b8422e

## Typography
- body: Inter 16px

## Elevation
Flat.

## Components
- button-primary

## Do's and Don'ts
- Do: use tokens.
EOF

# ---------- Step 1: validate-spec positive ----------
node "$SCRIPT_DIR/design-lint.mjs" --validate-spec "$TMP/DESIGN.md" >/dev/null 2>&1
if [[ $? -eq 0 ]]; then step "1 validate-spec positive" pass
else step "1 validate-spec positive" fail "exit non-zero on well-formed DESIGN.md"; fi

# ---------- Step 2: validate-spec negative ----------
# Break the DESIGN.md by removing frontmatter entirely.
cat > "$TMP/DESIGN-broken.md" <<'EOF'
## Overview
missing frontmatter
EOF
node "$SCRIPT_DIR/design-lint.mjs" --validate-spec "$TMP/DESIGN-broken.md" >/dev/null 2>&1
if [[ $? -eq 1 ]]; then step "2 validate-spec negative" pass
else step "2 validate-spec negative" fail "expected exit 1 on broken spec"; fi

# ---------- Step 3: design-lint clean file ----------
mkdir -p "$TMP/src/components/ui"
cat > "$TMP/src/components/ui/Clean.tsx" <<'EOF'
export const Clean = () => <div style={{ padding: '16px', borderRadius: '8px', color: '#b8422e' }} />;
EOF
node "$SCRIPT_DIR/design-lint.mjs" --design "$TMP/DESIGN.md" --files "$TMP/src/components/ui/Clean.tsx" >/dev/null 2>&1
if [[ $? -eq 0 ]]; then step "3 design-lint clean" pass
else step "3 design-lint clean" fail "expected exit 0 on token-compliant file"; fi

# ---------- Step 4: design-lint violations ----------
cat > "$TMP/src/components/ui/Rogue.tsx" <<'EOF'
export const Rogue = () => <div style={{ backgroundColor: '#beef00', padding: '14px', fontFamily: '"Papyrus"' }} />;
EOF
OUT=$(node "$SCRIPT_DIR/design-lint.mjs" --design "$TMP/DESIGN.md" --files "$TMP/src/components/ui/Rogue.tsx" 2>&1)
RC=$?
if [[ $RC -eq 2 && "$OUT" == *"color.hex"* && "$OUT" == *"length.px"* ]]; then
  step "4 design-lint violations" pass
else
  step "4 design-lint violations" fail "exit=$RC expected=2 — missing expected violation kinds in output"
fi

# ---------- Step 5: catalog basic scan ----------
mkdir -p "$TMP/src/components/marketing"
cat > "$TMP/src/components/ui/Button.tsx" <<'EOF'
/** Primary button primitive. */
export const Button = () => null;
EOF
cat > "$TMP/src/components/marketing/Hero.tsx" <<'EOF'
/** Marketing hero block. */
export const Hero = () => null;
EOF
cat > "$TMP/PRODUCT.md" <<'EOF'
# Product
## Register
product
## Surfaces

- name: ui
  route: components/ui/**
  register: product
  design_ref: DESIGN.md

- name: marketing
  route: components/marketing/**
  register: brand
  design_ref: DESIGN.md
EOF
node "$SCRIPT_DIR/catalog-components.mjs" --out "$TMP/catalog.md" --root "$TMP" >/dev/null 2>&1
if [[ -f "$TMP/catalog.md" ]] && \
   grep -q "Surface: marketing" "$TMP/catalog.md" && \
   grep -q "Surface: ui" "$TMP/catalog.md" && \
   grep -q "Button" "$TMP/catalog.md" && \
   grep -q "Hero" "$TMP/catalog.md"; then
  step "5 catalog basic scan" pass
else
  step "5 catalog basic scan" fail "expected Button under ui and Hero under marketing"
fi

# ---------- Step 6: catalog empty project ----------
EMPTY=$(mktemp -d "${TMPDIR:-/tmp}/rivet-skill-empty.XXXXXX")
node "$SCRIPT_DIR/catalog-components.mjs" --out "$EMPTY/catalog.md" --root "$EMPTY" >/dev/null 2>&1
if [[ -f "$EMPTY/catalog.md" ]] && grep -q "no components found" "$EMPTY/catalog.md"; then
  step "6 catalog empty project" pass
else
  step "6 catalog empty project" fail "expected empty-project placeholder text"
fi
rm -rf "$EMPTY"

# ---------- Step 7: check-reuse pass ----------
cat > "$TMP/tsconfig.json" <<'EOF'
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
EOF
mkdir -p "$TMP/src/pages"
cat > "$TMP/src/pages/pricing-uses-button.tsx" <<'EOF'
import { Button } from '@/components/ui/Button';
export default () => <Button />;
EOF
node "$SCRIPT_DIR/check-reuse.mjs" --reuse "@/components/ui/Button" --files "$TMP/src/pages/pricing-uses-button.tsx" --root "$TMP" >/dev/null 2>&1
if [[ $? -eq 0 ]]; then step "7 check-reuse pass" pass
else step "7 check-reuse pass" fail "expected exit 0 when import matches declared reuse"; fi

# ---------- Step 8: check-reuse fail ----------
cat > "$TMP/src/pages/pricing-ignores-button.tsx" <<'EOF'
export default () => <div>nothing here</div>;
EOF
OUT=$(node "$SCRIPT_DIR/check-reuse.mjs" --reuse "@/components/ui/Button" --files "$TMP/src/pages/pricing-ignores-button.tsx" --root "$TMP" 2>&1)
RC=$?
if [[ $RC -eq 2 && "$OUT" == *"declared reuse of this primitive"* ]]; then
  step "8 check-reuse fail" pass
else
  step "8 check-reuse fail" fail "exit=$RC expected=2 — missing unused-declaration message"
fi

# ---------- Step 9: similarity scores ----------
SIM_SAME=$(node -e "import('$SCRIPT_DIR/similarity.mjs').then(m => console.log(m.similarity({name:'PricingCard',purpose:'tier plan display'},{name:'PricingCard',purpose:'tier plan display'})))")
SIM_GRAY=$(node -e "import('$SCRIPT_DIR/similarity.mjs').then(m => console.log(m.similarity({name:'Button',purpose:'primary CTA'},{name:'FancyButton',purpose:'primary CTA with decoration'})))")
SIM_DIFF=$(node -e "import('$SCRIPT_DIR/similarity.mjs').then(m => console.log(m.similarity({name:'Table',purpose:'data grid'},{name:'Modal',purpose:'overlay dialog'})))")

# Use awk for threshold comparisons because bash can't compare floats directly.
check_sim() {
  local val=$1 op=$2 threshold=$3
  awk -v v="$val" -v t="$threshold" -v o="$op" 'BEGIN { exit !(o=="ge" ? v>=t : v<=t) }'
}

if check_sim "$SIM_SAME" ge 0.95 && check_sim "$SIM_GRAY" ge 0.35 && check_sim "$SIM_GRAY" ge 0.35 && check_sim "$SIM_DIFF" ge 0.0 && check_sim "$SIM_DIFF" ge -0.01 && check_sim "$SIM_DIFF" ge -0.01; then
  # Refined: same>=0.95 (auto-flag band), gray in [0.35,0.8) (gray-zone band), diff<=0.35 (auto-pass band)
  if check_sim "$SIM_SAME" ge 0.95 && \
     check_sim "$SIM_GRAY" ge 0.35 && \
     awk -v v="$SIM_GRAY" 'BEGIN { exit !(v<0.80) }' && \
     check_sim "$SIM_DIFF" ge 0.0 && \
     awk -v v="$SIM_DIFF" 'BEGIN { exit !(v<=0.35) }'; then
    step "9 similarity scores" pass
  else
    step "9 similarity scores" fail "same=$SIM_SAME gray=$SIM_GRAY diff=$SIM_DIFF — expected bands same≥0.95, 0.35≤gray<0.80, diff≤0.35"
  fi
else
  step "9 similarity scores" fail "same=$SIM_SAME gray=$SIM_GRAY diff=$SIM_DIFF — expected bands same≥0.95, 0.35≤gray<0.80, diff≤0.35"
fi

# ---------- Step 10: classify function ----------
CLS_SAME=$(node -e "import('$SCRIPT_DIR/similarity.mjs').then(m => console.log(m.classify(1.0)))")
CLS_GRAY=$(node -e "import('$SCRIPT_DIR/similarity.mjs').then(m => console.log(m.classify(0.5)))")
CLS_DIFF=$(node -e "import('$SCRIPT_DIR/similarity.mjs').then(m => console.log(m.classify(0.2)))")

if [[ "$CLS_SAME" == "auto-flag" && "$CLS_GRAY" == "gray-zone" && "$CLS_DIFF" == "auto-pass" ]]; then
  step "10 similarity classify bands" pass
else
  step "10 similarity classify bands" fail "got same=$CLS_SAME gray=$CLS_GRAY diff=$CLS_DIFF"
fi

# ---------- Summary ----------
echo ""
echo "────────────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo "Failed steps:"
  for s in "${FAILED_STEPS[@]}"; do echo "  - $s"; done
  exit 1
fi
exit 0
