---
name: vanity-studio
description: Design, edit, preview and render videos with the standalone Vanity Studio editor and its JSON CLI. Use for ads, reels, explainers, reference-led motion design and edits to existing Studio projects.
---

# Vanity Studio

Use the existing editor through local commands. The calling agent owns the creative decisions; no Vanity account, agent, MCP server or second language model is needed. Requirements: Node.js 22+, Chrome or Edge, and a local VanityStudio checkout. Clip inspection additionally uses ffprobe (FFmpeg).

Run the helper at this skill's `scripts/studio.mjs`. It locates the editor from the checkout, `VANITY_STUDIO_ROOT`, `--studio-root <directory>`, or the installed skill's `studio-root.json`. All project media paths are relative to the composition JSON file, unless absolute. Keep work in the user's chosen output/project folder.

## Discover the actual editor contract

```sh
node <skill>/scripts/studio.mjs docs
node <skill>/scripts/studio.mjs spec
```

Read the relevant scene, composition, text, motion, effects and audio sections. Use the editor's documented fields and current IDs. Do not substitute another rendering engine or guess unsupported effects. For an existing project, read its JSON and patch the requested properties while retaining its media, audio and timing.

## Design the film

Preserve the brief's language, duration, aspect ratio, copy, claims and references. Inspect the supplied references and source media before designing. Extract palette, type hierarchy, spacing, surfaces, image treatment and depth; exclude surrounding social-app controls and unrelated branding. Recreate that visual language with editable layers rather than using the reference screenshot as a slide.

Plan each beat's purpose, focal subject, action, readable hold and connection to the next beat. Vary composition, scale and action within one coherent visual system. Use measured `kind=group` row/column layouts for related elements and `text.box` for backed labels/buttons. Bound the type instead of shrinking crowded copy. Begin around 84 px for headlines and 44 px for support at 1080-pixel width, then fit the actual reference and viewing conditions.

Preserve planned subject action. A still zoom does not implement a person moving, a camera travelling through a scene, or a paper tear. Use actual footage or author the required motion. Place an included clip in `scene.video` or a `kind=video` layer; use `from`/`dur` to trim, `speed` to retime, or `loop` when justified. Preserve truthful product/interface evidence. Keep generated art free of baked-in headlines and subtitles.

## Account for generated assets

Use the calling environment's image/video generation tools when the concept needs original assets. Immediately register each successfully generated file with the helper, including a source relationship for derived footage:

```sh
node <skill>/scripts/studio.mjs asset-add project.json media/hero.png
node <skill>/scripts/studio.mjs asset-add project.json media/hero.mp4 --source media/hero.png
node <skill>/scripts/studio.mjs assets project.json
```

The helper stores a ledger beside the doc as `project.json.assets.json`. Every registered result must be used in the final composition, or inspected and rejected for a specific quality defect. An included generated clip consumes its registered source still; a redundant still shot is unnecessary. An experiment, preference for another asset, or clip length is not a quality defect.

If a result looks unusable, inspect the actual asset before rejecting it:

```sh
node <skill>/scripts/studio.mjs asset-inspect project.json media/hero.mp4
# Open the returned preview image with the calling agent's image-view tool.
node <skill>/scripts/studio.mjs asset-reject project.json media/hero.mp4 --defect wrong-motion --reason "The requested paper tear never occurs; only a static aperture is shown."
```

Allowed defects: blur, artifacts, distortion, wrong-content, wrong-motion, unreadable. Report observed defects, not excuses. Unreadable needs a recorded decoder failure. Inspection and rejection are tied to the file's hash; modifying it invalidates them. The helper enforces disposition for registered assets, but does not independently judge aesthetic quality or discover generations made without registration.

## Inspect and render

Write the composition as the editor's JSON doc, then validate it and inspect representative frames from every scene, including reveal, hold and transition moments:

```sh
node <skill>/scripts/studio.mjs validate project.json
node <skill>/scripts/studio.mjs sheet project.json preview.jpg
node <skill>/scripts/studio.mjs frame project.json detail.png --t 2.4
```

Open the returned images. Check reference fidelity, hierarchy, contrast, overlap, clipping, mobile-safe placement, copy density and actual asset use. A successful validation is not an aesthetic approval. Check motion with multiple frames or playback. Inspect the soundtrack and speech when present; respect the requested total duration. Use one subtitle system, allocate its space, and avoid captions that duplicate the headline or another subtitle track.

Patch concrete defects and recheck affected frames. Record the actual visual findings in the delivery notes; do not claim an unperformed review. Render only after the current composition and asset inventory pass:

```sh
node <skill>/scripts/studio.mjs render project.json final.mp4
```

Use the helper's render command so an omitted generated asset blocks export. It invokes the existing editor CLI and returns its JSON result: actual output path/format, duration, warnings, contact sheet and timeline. It also writes the generated-asset audit beside the output. Inspect the final video/sheet, report material limitations, and deliver the playable output plus the editable doc and needed assets. Do not claim agency-level quality from bitrate or validation alone.
