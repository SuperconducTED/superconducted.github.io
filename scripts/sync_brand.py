"""Copy the brand files the website uses from the SuperconducTED/.github repository.

Usage:
    python -I scripts/sync_brand.py <path to a SuperconducTED/.github clone> <commit>

Files are read from git objects at <commit> (`git show <commit>:<path>`), never from the working
tree, so line-ending conversion or uncommitted edits in the clone cannot change them. Each file
is written byte for byte under static/, and data/brand.yaml records the commit and every file's
SHA-256, which scripts/check_site.py compares against the files in static/.

The site never redraws the mark: re-run this script after the brand kit changes.
"""
import hashlib
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# source path in the .github repo -> path under static/
FILES = {
    "brand/kit/svg/superconducted-compact-on-light.svg": "brand/compact-on-light.svg",
    "brand/kit/svg/superconducted-compact-on-dark.svg": "brand/compact-on-dark.svg",
    "brand/kit/svg/superconducted-mark-on-light.svg": "brand/mark-on-light.svg",
    "brand/kit/svg/superconducted-mark-on-dark.svg": "brand/mark-on-dark.svg",
    "brand/kit/web/favicon.svg": "favicon.svg",
    "brand/kit/web/favicon-16.png": "favicon-16.png",
    "brand/kit/web/favicon-32.png": "favicon-32.png",
    "brand/kit/web/favicon-48.png": "favicon-48.png",
    "brand/kit/web/app-icon-180.png": "apple-touch-icon.png",
    "brand/kit/web/app-icon-192.png": "app-icon-192.png",
    "brand/kit/web/app-icon-512.png": "app-icon-512.png",
    "brand/kit/web/social-card-noise-engine.png": "social-card.png",
}


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    repo, ref = sys.argv[1], sys.argv[2]
    full = subprocess.run(["git", "-C", repo, "rev-parse", "--verify", ref + "^{commit}"],
                          check=True, capture_output=True, text=True).stdout.strip()
    lines = [
        "# Written by scripts/sync_brand.py; do not edit by hand.",
        "source_repo: SuperconducTED/.github",
        f"source_commit: {full}",
        "files:",
    ]
    for src, dest in FILES.items():
        data = subprocess.run(["git", "-C", repo, "show", f"{full}:{src}"],
                              check=True, capture_output=True).stdout
        path = os.path.join(ROOT, "static", *dest.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        digest = hashlib.sha256(data).hexdigest()
        lines += [f"  - path: {dest}", f"    source: {src}", f"    sha256: {digest}"]
        print(f"{src} -> static/{dest} ({len(data)} bytes)")
    with open(os.path.join(ROOT, "data", "brand.yaml"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
