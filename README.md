# Render Consistency

A comparison site: 3D architectural renderings re-shot as medium format film
photographs, using one reusable prompt.

Each example is a before/after wipe slider — the original rendering on the left,
the AI output on the right — with a toggle to switch the output between
**Gemini** and **ChatGPT**. The prompt used for every image is on the page in a
collapsible section, and is also kept here as `prompt.txt`.

Prepared for Jeff Svitak.

## Structure

Static, no framework and no build step. Open `index.html`, or serve the folder.

```
index.html    markup and the prompt text
style.css     styles
app.js        wipe sliders, output toggles, copy button
images/       NN-slug--original.jpg / --gemini.jpg / --chatgpt.jpg
prompt.txt    the prompt, verbatim
```
