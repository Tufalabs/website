"""Pin the identity repo (Tufalabs/identity) into vendor/identity: the design rules the site is built on (css/tokens.css,
css/base.css, css/motion.css), the animated mark (js/creature.js), the mark in parts (mark/mark.svg) and the masters
(source/). The site never edits these; it takes a version.

    python3 tools/sync_identity.py v0.1.0                 # a tag (or any commit) of the identity repo
    python3 tools/sync_identity.py work                   # its working tree, while working on both at once
    python3 tools/sync_identity.py v0.1.0 ~/src/identity  # the identity repo elsewhere (default: ../../tufa-identity)
"""
import io, pathlib, shutil, subprocess, sys, tarfile

ROOT = pathlib.Path(__file__).parent.parent
VENDOR = ROOT / "vendor/identity"
PATHS = ("css/tokens.css", "css/base.css", "css/motion.css", "js/creature.js", "mark/mark.svg", "source")

ref = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
repo = pathlib.Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else (ROOT.parent.parent / "tufa-identity")
git = lambda *a: subprocess.run(["git", "-C", str(repo), *a], check=True, capture_output=True).stdout

if VENDOR.exists(): shutil.rmtree(VENDOR)
VENDOR.mkdir(parents=True)
if ref == "work":
    for p in PATHS:
        src, dst = repo / p, VENDOR / p
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dst) if src.is_dir() else shutil.copy2(src, dst)
    try: version = "work (" + git("rev-parse", "--short", "HEAD").decode().strip() + " + changes)"
    except subprocess.CalledProcessError: version = "work (no commits yet)"
else:
    with tarfile.open(fileobj=io.BytesIO(git("archive", "--format=tar", ref, *PATHS))) as tar: tar.extractall(VENDOR)
    version = f'{ref} ({git("rev-parse", "--short", ref + "^{commit}").decode().strip()})'
(VENDOR / "VERSION").write_text(version + "\n")
print("vendor/identity:", version, "·", sum(1 for f in VENDOR.rglob("*") if f.is_file()), "files")
