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

Plan each beat's purpose, focal subject, action, readable hold and connection to the next beat. Vary composition, scale and action within one coherent visual system. Use measured `kind=group` row/column layouts for related elements and `text.box` for backed labels/buttons. For copy inside a card, measure the full wrapped text bounds and keep every line within the card's inner bounds with padding. A text centre inside a card is insufficient; its last line can still spill outside. Resize or reposition the card and copy together, shorten secondary copy, or intentionally place that copy outside with a clear gap. Begin around 84 px for headlines and 44 px for support at 1080-pixel width, then fit the actual reference and viewing conditions.

Preserve planned subject action. A still zoom does not implement a person moving, a camera travelling through a scene, or a paper tear. Use actual footage or author the required motion. Place an included clip in `scene.video` or a `kind=video` layer; use `from`/`dur` to trim, `speed` to retime, or `loop` when justified. Preserve truthful product/interface evidence. Keep generated art free of baked-in headlines and subtitles.

## Account for generated assets

You are welcome to use any image or video generation tools available in the calling environment, including Gemini or other providers, when they improve the film's visual quality. Look for opportunities to create a strong hero image, relevant scene illustration, original background, or actual subject/camera motion instead of settling for generic text cards. Choose generation because it serves the brief and composition; quality does not require generation on every project. Respect the user's existing budget and provider permissions. Inspect the results and build them into the film. Immediately register each successfully generated file with the helper, including a source relationship for derived footage:

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

Open the returned images with the calling agent's image-view tool. Inspect every scene's reveal, readable hold and transition, and open full-size frames where text and card edges need closer inspection. Check reference fidelity, hierarchy, contrast, overlap, clipping, mobile-safe placement, copy density and actual asset use. In particular, follow every wrapped line to its right and bottom edge: text meant to belong to a card must stay inside with padding, decorative rules must not collide with copy, and headings must not sit against an edge. A preview command succeeding, or a clean automated report, does not prove the image looks good. Check motion with multiple frames or playback. Inspect the soundtrack and speech when present; respect the requested total duration. Use one subtitle system, allocate its space, and avoid captions that duplicate the headline or another subtitle track.

If you see overflow, poor alignment, awkward wrapping, collisions, unreadable copy, duplicate subtitles or another concrete defect, correct the composition before exporting. Do not merely describe a fixable defect in the delivery notes. Rebuild the sheet and affected full-size frames after changes, open them again and verify the correction. Continue until the visible defects are resolved. If an external limitation prevents correction, report it and do not approve the defective composition as finished.

Approve only a composition whose current sheet covers the editor's review sample times and whose full-size detail frames you have actually opened. Notes should identify the scene checks, corrections and any remaining nonblocking warnings. Do not invent findings or approve an earlier version. The helper ties review evidence to the document and local source media; edits invalidate approval:

```sh
node <skill>/scripts/studio.mjs review-approve project.json --notes "Reviewed every scene's reveal, hold and transition. Fixed the support copy overflowing its card; checked full-size frames for padding, readability and a single subtitle track."
```

Write truthful notes about this project; the example is not a substitute for inspection. The helper enforces fresh evidence and automatic composition checks, but cannot independently verify that an agent opened or correctly judged an image. Render only after the current composition and asset inventory pass:

```sh
node <skill>/scripts/studio.mjs render project.json final.mp4
```

Use the helper's render command: omitted generated assets, missing/stale review approval, or automatic composition errors block export. It invokes the existing editor CLI and returns its JSON result: actual output path/format, duration, warnings, contact sheet and timeline. It writes asset and review audits beside the output. Inspect the final video/sheet; if it shows a defect, correct the document, repeat preview/review and rerender before delivery. Report material limitations and deliver the playable output plus the editable doc and needed assets. Do not claim agency-level quality from bitrate or validation alone.
