#!/usr/bin/env bash
# check-coverage.sh — parse coverage/lcov.info and enforce per-layer thresholds
#
# Thresholds:
#   src/managers/  → line ≥ 90%, branch ≥ 80%
#   src/engines/   → line ≥ 88%, branch ≥ 80%
#     (88% accommodates the spawn 'error' event handler in LocalPipelineExecutor,
#      which is unreachable in tests since shell: true prevents spawn from erroring
#      on macOS/Linux — raise to 90% once that branch is covered or removed)
#   global         → line ≥ 85%
#
# Exit 0 on pass, exit 1 on first threshold violation.

set -euo pipefail

LCOV_FILE="${1:-coverage/lcov.info}"

if [[ ! -f "$LCOV_FILE" ]]; then
  echo "ERROR: lcov file not found at $LCOV_FILE" >&2
  echo "Run 'bun test --coverage' first." >&2
  exit 1
fi

# ─── helpers ──────────────────────────────────────────────────────────────────

# compute_line_pct <lcov_block>  →  prints integer percentage (0-100)
# A block is the text between two SF: lines.
compute_line_pct() {
  local block="$1"
  local lf lh
  lf=$(echo "$block" | grep -c "^DA:" 2>/dev/null || echo 0)
  lh=$(echo "$block" | grep "^DA:" | awk -F',' '$2 > 0' | wc -l | tr -d ' ')
  if [[ "$lf" -eq 0 ]]; then echo 100; return; fi
  echo $(( (lh * 100) / lf ))
}

# compute_branch_pct <lcov_block>  →  prints integer percentage (0-100)
compute_branch_pct() {
  local block="$1"
  local bf bh
  bf=$(echo "$block" | grep "^BRDA:" | wc -l | tr -d ' ')
  bh=$(echo "$block" | grep "^BRDA:" | awk -F',' '$4 > 0' | wc -l | tr -d ' ')
  if [[ "$bf" -eq 0 ]]; then echo 100; return; fi
  echo $(( (bh * 100) / bf ))
}

# ─── parse lcov.info ──────────────────────────────────────────────────────────

current_file=""
current_block=""
failed=0

# Accumulators for global line coverage
global_lf=0
global_lh=0

while IFS= read -r line; do
  if [[ "$line" == SF:* ]]; then
    current_file="${line#SF:}"
    current_block=""
  fi

  current_block+="${line}"$'\n'

  if [[ "$line" == "DA:"* ]]; then
    global_lf=$(( global_lf + 1 ))
    count=$(echo "$line" | awk -F',' '{print $2}')
    if [[ "$count" -gt 0 ]]; then
      global_lh=$(( global_lh + 1 ))
    fi
  fi

  if [[ "$line" == "end_of_record" ]]; then
    if [[ -z "$current_file" ]]; then
      current_block=""
      continue
    fi

    line_pct=$(compute_line_pct "$current_block")
    branch_pct=$(compute_branch_pct "$current_block")

    # ── managers layer ──
    if echo "$current_file" | grep -q "src/managers/"; then
      if [[ "$line_pct" -lt 90 ]]; then
        echo "ERROR: [managers] $current_file line coverage ${line_pct}% is below threshold 90%" >&2
        failed=1
      fi
      if [[ "$branch_pct" -lt 80 ]]; then
        echo "ERROR: [managers] $current_file branch coverage ${branch_pct}% is below threshold 80%" >&2
        failed=1
      fi
    fi

    # ── engines layer (includes executors/) ──
    if echo "$current_file" | grep -q "src/engines/"; then
      if [[ "$line_pct" -lt 88 ]]; then
        echo "ERROR: [engines] $current_file line coverage ${line_pct}% is below threshold 88%" >&2
        failed=1
      fi
      if [[ "$branch_pct" -lt 80 ]]; then
        echo "ERROR: [engines] $current_file branch coverage ${branch_pct}% is below threshold 80%" >&2
        failed=1
      fi
    fi

    current_file=""
    current_block=""
  fi
done < "$LCOV_FILE"

# ── global line coverage ──
if [[ "$global_lf" -gt 0 ]]; then
  global_pct=$(( (global_lh * 100) / global_lf ))
  if [[ "$global_pct" -lt 85 ]]; then
    echo "ERROR: [global] overall line coverage ${global_pct}% is below threshold 85%" >&2
    failed=1
  fi
fi

if [[ "$failed" -eq 1 ]]; then
  exit 1
fi

echo "✓ Coverage thresholds met"
