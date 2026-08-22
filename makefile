# ─── Renamiq Makefile ─────────────────────────────────────────────────────────
# Developer command interface — thin wrappers around project tools.

SHELL := /bin/bash

.DEFAULT_GOAL := help

.PHONY: install hooks dev tauri build app preview lint format fix typecheck test check rust clean help

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

# ─── Quality ──────────────────────────────────────────────────────────────────
lint: ## Lint (Biome check)
	@pnpm lint && echo "  ✓ Lint passed"

format: ## Format code (Biome write)
	@pnpm format && echo "  ✓ Formatted"

fix: ## Lint with auto-fix (Biome safe fixes)
	@pnpm exec biome check --write . && echo "  ✓ Fixes applied"

typecheck: ## Type-check (tsc --noEmit)
	@pnpm exec tsc --noEmit && echo "  ✓ Type check passed"

test: ## Run tests (Vitest)
	@pnpm test && echo "  ✓ Tests passed"

check: lint typecheck test build ## lint + typecheck + test + build
	@echo "  ✓ All checks passed"

rust: ## Rust checks (cargo fmt + clippy)
	@cd renamiq/src-tauri && cargo fmt --check && cargo clippy -- -D warnings && echo "  ✓ Rust checks passed"

# ─── Maintenance ──────────────────────────────────────────────────────────────
clean: ## Remove build output and target dir
	@rm -rf dist renamiq/src-tauri/target && echo "  ✓ Cleaned"

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
