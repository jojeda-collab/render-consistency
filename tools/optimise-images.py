"""Optimise the Render Consistency image set.

Rules, deliberately conservative so the small originals keep their exact bytes:
  - PNG / WEBP -> always re-encoded to JPEG (the big win, and the site only
    ever serves .jpg so every output lands on one extension)
  - JPEG over MAX_DIM -> resized and re-encoded
  - JPEG within MAX_DIM -> trial re-encode, kept ONLY if it saves at least
    SAVING_FLOOR; otherwise the original bytes are left exactly as they were

That last rule is what keeps this idempotent. A plain "re-encode anything over
N bytes" rule would re-fire on every run and stack up generations of JPEG loss.
Measuring the actual saving instead is self-limiting: once a file has been
through a pass it is already at QUALITY, so a second trial encode saves nothing
close to SAVING_FLOOR and the original is kept untouched.

Aspect ratio is preserved by scaling the long side to MAX_DIM and rounding the
short side, which is what the page uses to size each comparison container.
"""
import io
import os
import sys
from PIL import Image

ROOT = sys.argv[1] if len(sys.argv) > 1 else "images"
MAX_DIM = 2000
QUALITY = 82
SAVING_FLOOR = 0.30  # a trial re-encode must save this fraction to be kept

Image.MAX_IMAGE_PIXELS = None

rows = []
before_total = 0
after_total = 0

for dirpath, _dirnames, filenames in os.walk(ROOT):
    for fn in sorted(filenames):
        ext = os.path.splitext(fn)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            continue

        src = os.path.join(dirpath, fn)
        size_before = os.path.getsize(src)
        before_total += size_before

        with Image.open(src) as im:
            w, h = im.size
            needs_convert = ext in (".png", ".webp")
            too_big = max(w, h) > MAX_DIM

            if not (needs_convert or too_big):
                # Trial encode in memory; keep it only if the saving is real.
                buf = io.BytesIO()
                im.convert("RGB").save(buf, "JPEG", quality=QUALITY,
                                       optimize=True, progressive=True,
                                       subsampling=0)
                if buf.tell() > size_before * (1 - SAVING_FLOOR):
                    after_total += size_before
                    rows.append((src, w, h, size_before, w, h, size_before, "kept"))
                    continue
                with open(src, "wb") as out:
                    out.write(buf.getvalue())
                size_after = os.path.getsize(src)
                after_total += size_after
                rows.append((src, w, h, size_before, w, h, size_after, "recompressed"))
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

        if needs_convert:
            os.remove(src)

        size_after = os.path.getsize(dst)
        after_total += size_after
        rows.append((src, w, h, size_before, nw, nh, size_after,
                     (ext[1:] + "->jpg") if needs_convert else "re-encoded"))

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
