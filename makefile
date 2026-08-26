# ─── Renamiq Makefile ─────────────────────────────────────────────────────────
# Developer command interface — thin wrappers around project tools.

SHELL := /bin/bash

.DEFAULT_GOAL := help

.PHONY: install hooks dev tauri build app preview bundle bundle-mac bundle-linux bundle-windows lint format fix typecheck test check rust clean generate-test-media help

define LOGO
██████╗ ███████╗███╗   ██╗ █████╗ ███╗   ███╗██╗  ██████╗
██╔══██╗██╔════╝████╗  ██║██╔══██╗████╗ ████║██║██╔═══██╗
██████╔╝█████╗  ██╔██╗ ██║███████║██╔████╔██║██║██║   ██║
██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║██║╚██╔╝██║██║██║▄▄ ██║
██║  ██║███████╗██║ ╚████║██║  ██║██║ ╚═╝ ██║██║╚██████╔╝
╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚══▀▀═╝
endef
export LOGO

# ─── Setup ────────────────────────────────────────────────────────────────────
install: ## Install dependencies (pnpm)
	@pnpm install && echo "  ✓ Dependencies installed"

hooks: ## Install git hooks (lefthook)
	@pnpm exec lefthook install && echo "  ✓ Git hooks installed"

precommit: ## Run lefthook pre-commit hooks manually
	@pnpm exec lefthook run pre-commit && echo "  ✓ Pre-commit passed"

prepush: ## Run lefthook pre-push hooks manually
	@pnpm exec lefthook run pre-push && echo "  ✓ Pre-push passed"

github-action: ## Simulate GitHub Actions locally
	@./scripts/ci-simulator.sh

# ─── Development ──────────────────────────────────────────────────────────────
dev: ## Frontend dev server (Vite HMR)
	@pnpm dev

app: ## Run desktop app (Tauri + Vite HMR)
	@pnpm tauri dev

# ─── Build ────────────────────────────────────────────────────────────────────
build: ## Frontend production build (tsc + vite)
	@pnpm build && echo "  ✓ Frontend built"

preview: ## Preview frontend production build
	@pnpm preview

# ─── Distribution ─────────────────────────────────────────────────────────────
# Cross-compiling from mac needs extra toolchain; CI runner on target OS is safer.
# Output lands in src-tauri/target/release/bundle/.
bundle: ## Bundle current OS target (Tauri, config-defined targets)
	@pnpm tauri build && echo "  ✓ Bundled"

bundle-mac: ## Bundle macOS .dmg (Apple Silicon)
	@pnpm tauri build --target aarch64-apple-darwin --bundles dmg && echo "  ✓ macOS (arm64) bundled"

bundle-linux: ## Bundle Linux AppImage
	@pnpm tauri build --bundles appimage && echo "  ✓ Linux (AppImage) bundled"

bundle-windows: ## Bundle Windows installer (.exe NSIS)
	@pnpm tauri build --bundles nsis && echo "  ✓ Windows (NSIS) bundled"

# ─── Quality ──────────────────────────────────────────────────────────────────
lint: ## Lint (Biome check)
	@pnpm lint && echo "  ✓ Lint passed"

format: ## Format code (Biome write)
	@pnpm format && echo "  ✓ Formatted"

fix: ## Lint with auto-fix (Biome safe fixes)
	@pnpm exec biome check --write . && echo "  ✓ Fixes applied"

typecheck: ## Type-check (tsc --noEmit)
	@pnpm exec tsc --noEmit && echo "  ✓ Type check passed"

test: ## Run all tests (Vitest + Cargo)
	@pnpm test && cd src-tauri && cargo test && echo "  ✓ All tests passed"

check: lint typecheck test build ## lint + typecheck + test + build
	@echo "  ✓ All checks passed"

rust: ## Rust checks (cargo fmt + clippy)
	@cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && echo "  ✓ Rust checks passed"

# ─── Maintenance ──────────────────────────────────────────────────────────────
clean: ## Remove build output and target dir
	@rm -rf dist src-tauri/target && echo "  ✓ Cleaned"

generate-test-media: ## Generate dummy test media files
	@./scripts/generate-test-media.sh

# ─── Help ─────────────────────────────────────────────────────────────────────
help: ## Show this help
	@printf "\n"
	@printf "\033[1;36m"
	@printf "%s\n" "$$LOGO"
	@printf "\033[0m\n"
	@awk 'BEGIN {FS = ":.*##"; section = ""; last = ""; line = "──────────────────────────────────────────────────────────────────────"} \
	/^# ─── / { \
		s=$$0; gsub(/^# ──+ /,"",s); gsub(/ ──+.*$$/,"",s); section=s; \
	} \
	/^[a-zA-Z_-]+:.*##/ { \
		t=$$1; d=$$2; \
		if (section != last) { \
			if (last != "") printf "\033[2;37m└" line "┘\033[0m\n\n"; \
			printf "\033[2;37m┌──────────────────────────────────────────────────────────────────────┐\033[0m\n"; \
			printf "\033[2;37m│ \033[1;37m%-60s\033[0m \033[2;37m        │\033[0m\n", section; \
			printf "\033[2;37m├──────────────────────────────────────────────────────────────────────┤\033[0m\n"; \
			last = section; \
		} \
		printf "\033[2;37m│ \033[1;36m%-28s\033[0m \033[2;37m%-39s\033[0m \033[2;37m│\033[0m\n", t, d; \
	} END {printf "\033[2;37m└" line "┘\033[0m\n\n";}' $(MAKEFILE_LIST)
	@printf "\033[2;37m→\033[0m \033[1;37mmake\033[0m \033[1;36m<command>\033[0m\n"
	@printf "\n"
