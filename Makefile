# Aether Shell - install / uninstall
#
# make            # bundle to dist/
# sudo make install
# sudo make uninstall

PREFIX      ?= /usr
DESTDIR     ?=
SHARE_DIR    = $(DESTDIR)$(PREFIX)/share/aether-shell
BIN_DIR      = $(DESTDIR)$(PREFIX)/bin
UNIT_DIR     = $(DESTDIR)$(PREFIX)/lib/systemd/user
LICENSE_DIR  = $(DESTDIR)$(PREFIX)/share/licenses/aether-shell

SOURCES = app.ts package.json tsconfig.json widget service style config assets

.PHONY: all deps bundle install uninstall dev run clean fmt check

all: bundle

deps:
	@./scripts/check-deps.sh

bundle: deps
	@mkdir -p dist
	ags bundle app.ts dist/aether-shell --gtk4
	@echo "built dist/aether-shell"

dev:
	ags run . --gtk4

run: dev

check:
	@./scripts/check-deps.sh
	@npx --yes typescript@latest tsc --noEmit || true

fmt:
	@npx --yes prettier --write "**/*.{ts,tsx,scss,json,md}"

install: bundle
	install -Dm755 dist/aether-shell $(SHARE_DIR)/aether-shell
	install -Dm755 bin/aether-shell   $(BIN_DIR)/aether-shell
	install -Dm644 config/default.json $(SHARE_DIR)/config/default.json
	cp -r config/hyprland $(SHARE_DIR)/config/
	cp -r assets $(SHARE_DIR)/ 2>/dev/null || true
	install -Dm644 systemd/aether-shell.service $(UNIT_DIR)/aether-shell.service
	install -Dm644 LICENSE $(LICENSE_DIR)/LICENSE
	@echo
	@echo "Installed. Next:"
	@echo "  aether-shell setup      # store your API key (Grok/xAI by default)"
	@echo "  systemctl --user enable --now aether-shell"
	@echo
	@echo "Your config at ~/.config/aether/config.json is never touched by install."

uninstall:
	-systemctl --user disable --now aether-shell 2>/dev/null || true
	rm -rf $(SHARE_DIR)
	rm -f  $(BIN_DIR)/aether-shell
	rm -f  $(UNIT_DIR)/aether-shell.service
	rm -rf $(LICENSE_DIR)
	@echo "Removed. User config in ~/.config/aether was left in place."
	@echo "Delete it manually if you want a clean slate:  rm -rf ~/.config/aether"

clean:
	rm -rf dist node_modules
