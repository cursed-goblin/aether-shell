# Publishing and release checklist

This repo is already public at <https://github.com/cursed-goblin/aether-shell>. What
follows is the checklist for anyone forking it, plus the release steps that still need to
be run locally.

---

## Before you push \u2014 checklist

### 1. Confirm no secrets are in the tree

```bash
cd aether-shell
git ls-files | xargs grep -nE '(sk-|xai-|sk-ant-|gsk_|AIza)[A-Za-z0-9_-]{10,}' || echo "clean"
```

Expected output: `clean`. `secrets.json`, `.env` and `*.key` are already in `.gitignore`,
and no API key is ever written to `config.json` by design \u2014 but verify anyway. A key
pushed to a public repo is compromised within minutes, and deleting the commit does not
un-compromise it.

### 2. Replace the placeholder identity (forks only)

```bash
grep -rn 'cursed-goblin' --exclude-dir=.git .
```

Files that carry the owner name: `README.md`, `PKGBUILD`, `flake.nix`,
`systemd/aether-shell.service`, `service/providers.ts` (the OpenRouter `HTTP-Referer`
header). Fix them in one shot:

```bash
grep -rl 'cursed-goblin' --exclude-dir=.git . | xargs sed -i 's/cursed-goblin/YOUR_GITHUB_USER/g'
```

Also set your name and email in `PKGBUILD`'s `# Maintainer:` line and in `LICENSE`.

### 3. Restore the executable bits

Files uploaded through the GitHub API lose mode `755`. After cloning:

```bash
chmod +x bin/aether-shell scripts/check-deps.sh
git update-index --chmod=+x bin/aether-shell scripts/check-deps.sh
git commit -m "chore: mark scripts executable"
```

`make install` uses `install -Dm755`, so a system install is unaffected either way \u2014 this
only matters when running from a clone.

### 4. Check the screenshot renders

`assets/screenshots/overview.png` is referenced from the README. If you swap it, keep
the filename or update the `<img>` tag.

---

## Create the repo and push (forks)

### With the GitHub CLI (easiest)

```bash
gh auth login
gh repo create aether-shell \\
  --public \\
  --source=. \\
  --description="Glassmorphic GTK4/Wayland desktop shell with an API-key driven AI agent" \\
  --push
```

That creates the remote, sets `origin`, and pushes `main` in one command.

### Without the CLI

Create an empty repo at <https://github.com/new> \u2014 **no** README, license or `.gitignore`,
since this repo already has all three and pre-populating causes a merge conflict on the
first push. Then:

```bash
git remote add origin git@github.com:YOUR_GITHUB_USER/aether-shell.git
git branch -M main
git push -u origin main
```

---

## After you push \u2014 checklist

### 1. Repo settings

| Setting | Value |
|---|---|
| Description | Glassmorphic GTK4/Wayland desktop shell with an API-key driven AI agent |
| Topics | `wayland` `hyprland` `gtk4` `astal` `ags` `desktop-shell` `glassmorphism` `linux-desktop` `ai` `grok` |
| Website | leave empty or point at your dotfiles |
| Issues | on |
| Discussions | on \u2014 ricing repos live on these |
| Wiki | off, `docs/` is the documentation |

Topics matter more than you would expect. `hyprland` and `glassmorphism` are how people
actually find rice repos.

### 2. Enable Actions

CI is at `.github/workflows/ci.yml`. It shellchecks the scripts, validates the JSON, and
compiles the SCSS on every push. Go to the Actions tab and enable workflows if prompted.

### 3. Tag a release

```bash
git tag -a v0.1.0 -m "Aether Shell 0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0" --notes "First public release."
```

The `PKGBUILD` `source=` line points at
`$url/archive/refs/tags/v$pkgver.tar.gz`, so it only works once a tag exists.

### 4. Update the PKGBUILD checksum

```bash
updpkgsums     # from pacman-contrib
makepkg --printsrcinfo > .SRCINFO
```

The shipped `sha256sums=('SKIP')` is fine for local builds but should be a real hash
before you publish to the AUR.

### 5. Publish to the AUR (optional)

```bash
git clone ssh://aur@aur.archlinux.org/aether-shell.git aur-aether
cp PKGBUILD .SRCINFO aur-aether/
cd aur-aether && git add . && git commit -m "Initial import" && git push
```

AUR requires `.SRCINFO` to be committed alongside `PKGBUILD`, and rejects the push if
they disagree.

### 6. Share it

r/unixporn accepts posts with the screenshot plus a top-level comment listing the
components. Mention Hyprland, GTK4/Astal, and that the AI panel is bring-your-own-key \u2014
that last part is the differentiator, since most rices have no agent at all.

---

## Ongoing

```bash
git switch -c feature/thing
# ...
make check && make fmt
git commit -am "add thing"
git push -u origin feature/thing
gh pr create
```

Before each release: bump `version` in `package.json` and `pkgver` in `PKGBUILD`, update
the changelog, tag, push the tag.

---

## If you make it private

Nothing breaks, but `nix run github:you/aether-shell` and the AUR `source=` URL both stop
working for anyone but you. Keep it public if you want the install instructions in the
README to be true.
