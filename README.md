# Render Consistency

A comparison site: 3D architectural renderings re-shot as medium format film
photographs, using one reusable prompt.

Projects are switched with the tabs at the top (deep-linkable, e.g. `#29`). Each example is a before/after wipe slider — the original rendering on the left,
the AI output on the right — with a toggle to switch the output between
**Gemini** and **ChatGPT**. The prompt used for every image is on the page in a
collapsible section, and is also kept here as `prompt.txt`.

Prepared for Jeff Svitak.

## Structure

Static, no framework and no build step. Open `index.html`, or serve the folder.

```
index.html      the comparisons, and the prompt text
gemini.html     every Gemini output on its own
chatgpt.html    every ChatGPT output on its own
style.css       styles for all three pages
data.js         the project list, shared by every page
app.js          wipe sliders, output toggles, copy button
gallery.js      builds the per-model gallery pages
images/         <project>/NN--original.jpg / --gemini.jpg / --chatgpt.jpg
downloads/      one zip per model, plus manifest.json
prompt.txt      the prompt, verbatim
tools/          make-zips.py, optimise-images.py
```

`data.js` is the single source of truth for which projects and examples exist.
Add a project there and every page picks it up.

## After adding or replacing images

Images are capped at 2000px on the long side and stored as progressive JPEG
(q82, no chroma subsampling — these are flat overcast frames where the grain
and the sky cast are the point). Two helpers keep that consistent:

```
python tools/optimise-images.py images   # resize / re-encode, png -> jpg
python tools/make-zips.py                # rebuild the download bundles
```

Both are safe to re-run: the optimiser leaves anything already within those
bounds untouched, byte for byte.
