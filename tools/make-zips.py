"""Build the per-model download bundles.

Run from the repo root after adding or replacing any image:

    python tools/make-zips.py

Writes downloads/render-consistency-<model>.zip, each containing a single
folder of flatly named files (the-prospect-01.jpg, 29-02.jpg, ...) so the
extracted folder is readable without any nesting to dig through.
"""
import json
import os
import re
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "downloads")
MODELS = ("gemini", "chatgpt")


PROJECT_RE = re.compile(
    r"\{\s*id:\s*'([^']+)'\s*,\s*"
    r"name:\s*'([^']*)'\s*,\s*"
    r"count:\s*(\d+)\s*,\s*"
    r"outputs:\s*\[([^\]]*)\]",
    re.S,
)


def load_projects():
    """Read the project list straight out of data.js so this stays in sync."""
    with open(os.path.join(ROOT, "data.js"), encoding="utf-8") as fh:
        text = fh.read()
    projects = [
        {
            "id": pid,
            "name": name,
            "count": int(count),
            "outputs": re.findall(r"'([^']+)'", outs),
        }
        for pid, name, count, outs in PROJECT_RE.findall(text)
    ]
    if not projects:
        raise SystemExit("could not parse any projects out of data.js")
    return projects


def main():
    projects = load_projects()
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {}

    for model in MODELS:
        stem = "render-consistency-%s" % model
        zip_path = os.path.join(OUT_DIR, stem + ".zip")
        files = []

        for p in projects:
            for i in range(1, p["count"] + 1):
                name = "%02d" % i
                src = os.path.join(ROOT, "images", p["id"], "%s--%s.jpg" % (name, model))
                if model in p["outputs"] and os.path.exists(src):
                    files.append((src, "%s/%s-%s.jpg" % (stem, p["id"], name)))

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for src, arc in files:
                z.write(src, arc)

        size = os.path.getsize(zip_path)
        manifest[model] = {"files": len(files), "bytes": size}
        print("%-40s %2d files  %5.1f MB" % (
            os.path.relpath(zip_path, ROOT).replace("\\", "/"),
            len(files), size / 1048576.0))

    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    print("wrote downloads/manifest.json")


if __name__ == "__main__":
    main()
