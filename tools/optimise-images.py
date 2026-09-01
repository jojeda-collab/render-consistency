"""Optimise the Render Consistency image set.

Rules, deliberately conservative so the small originals keep their exact bytes:
  - PNG  -> always re-encoded to JPEG (the big win; PNG is wrong for photos)
  - JPEG -> re-encoded only if it is over MAX_DIM on a side
  - anything already within MAX_DIM is left untouched

Both conditions are things a single pass fixes permanently, which makes this
script idempotent: re-running it re-encodes nothing and so cannot stack up
generations of JPEG loss. Do not add a "re-encode anything over N bytes" rule
— a file that is still large after a pass is already at QUALITY, and would be
re-encoded on every subsequent run.

Aspect ratio is preserved by scaling the long side to MAX_DIM and rounding the
short side, which is what the page uses to size each comparison container.
"""
import os
import sys
from PIL import Image

ROOT = sys.argv[1] if len(sys.argv) > 1 else "images"
MAX_DIM = 2000
QUALITY = 82

Image.MAX_IMAGE_PIXELS = None

rows = []
before_total = 0
after_total = 0

for dirpath, _dirnames, filenames in os.walk(ROOT):
    for fn in sorted(filenames):
        ext = os.path.splitext(fn)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png"):
            continue

        src = os.path.join(dirpath, fn)
        size_before = os.path.getsize(src)
        before_total += size_before

        with Image.open(src) as im:
            w, h = im.size
            is_png = ext == ".png"
            too_big = max(w, h) > MAX_DIM

            if not (is_png or too_big):
                after_total += size_before
                rows.append((src, w, h, size_before, w, h, size_before, "kept"))
                continue

            im = im.convert("RGB")
            nw, nh = w, h
            if too_big:
                scale = MAX_DIM / float(max(w, h))
                nw = max(1, int(round(w * scale)))
                nh = max(1, int(round(h * scale)))
                im = im.resize((nw, nh), Image.LANCZOS)

            dst = os.path.join(dirpath, os.path.splitext(fn)[0] + ".jpg")
            im.save(dst, "JPEG", quality=QUALITY, optimize=True,
                    progressive=True, subsampling=0)

        if is_png:
            os.remove(src)

        size_after = os.path.getsize(dst)
        after_total += size_after
        rows.append((src, w, h, size_before, nw, nh, size_after,
                     "png->jpg" if is_png else "re-encoded"))

name_w = max(len(r[0]) for r in rows)
for src, w, h, sb, nw, nh, sa, what in rows:
    print("%-*s  %9s -> %-9s %7.2f -> %6.2f MB  %s" % (
        name_w, src.replace("\\", "/"),
        "%dx%d" % (w, h), "%dx%d" % (nw, nh),
        sb / 1048576.0, sa / 1048576.0, what))

print()
print("TOTAL  %.1f MB -> %.1f MB  (%.0f%% smaller)" % (
    before_total / 1048576.0, after_total / 1048576.0,
    100.0 * (1 - after_total / float(before_total))))
