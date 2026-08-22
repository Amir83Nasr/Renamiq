#!/usr/bin/env bash
# ─── GitHub Actions Local Simulator ──────────────────────────────────────────
# Simulates CI checks locally using make targets matching .github/workflows/ci.yml

set -e

echo "=============================================="
echo "  🚀 Starting Local GitHub Actions Simulator  "
echo "=============================================="

echo ""
echo "=== [Job 1/2] web: Lint, typecheck & test ==="
echo "→ Running: pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

echo "→ Running: pnpm exec biome check ."
pnpm exec biome check .

echo "→ Running: pnpm exec tsc --noEmit"
pnpm exec tsc --noEmit

echo "→ Running: pnpm test"
pnpm test

echo ""
echo "=== [Job 2/2] rust: Clippy & checks ==="
echo "→ Running: cd src-tauri && cargo fmt --check"
cd src-tauri
cargo fmt --check

echo "→ Running: cargo clippy --all-targets -- -D warnings"
cargo clippy --all-targets -- -D warnings
cd ..

echo ""
echo "=============================================="
echo "  ✅ All GitHub Actions simulated successfully!"
echo "=============================================="
