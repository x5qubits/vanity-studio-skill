# Vanity Studio access skill

Let Codex, Claude Code, or another agent use your existing Vanity Studio editor to design, edit, preview, and render videos.

**This repository contains only the agent skill and command adapter. It does not contain the editor, rendering engine, editor assets, or Vanity backend, and does not grant a license to the editor.** Obtain access to the editor separately. No MCP server or second AI agent is required.

## Requirements

- An existing local Vanity Studio installation with `tools/render.mjs`.
- Node.js 22 or newer and Chrome or Edge.
- FFmpeg's `ffprobe` on PATH for generated-video inspection.
- An agent that can read instructions, execute local commands, and inspect preview images.

The calling agent supplies the creative reasoning and its own optional image/video generation tools. The adapter itself makes no model API calls. Model subscriptions, API usage, and generated assets may have separate costs.

## Install

Clone this repository, then install the skill for your agent:

```sh
git clone https://github.com/x5qubits/vanity-studio-skill.git
cd vanity-studio-skill
node tools/install.mjs --agent codex --studio-root /path/to/VanityStudio
# Or: --agent claude, or --agent both
```

The installer copies `skills/vanity-studio/` to the agent's personal skill directory and records the editor location in a local `studio-root.json`. Restart your agent session if needed for discovery. It does not copy, download, or modify the editor.

Alternatively, copy the complete `skills/vanity-studio` folder into your agent's skill directory and set `VANITY_STUDIO_ROOT` to your editor installation. Any other agent can read `skills/vanity-studio/SKILL.md` directly and invoke its script with `--studio-root`.

## Use

In Codex, invoke `$vanity-studio`. In Claude Code, invoke `/vanity-studio`. Give the agent your video brief and any visual references.

The adapter can also be called directly from the clone:

```sh
node skills/vanity-studio/scripts/studio.mjs docs --studio-root /path/to/VanityStudio
node skills/vanity-studio/scripts/studio.mjs spec --studio-root /path/to/VanityStudio
node skills/vanity-studio/scripts/studio.mjs validate project.json --studio-root /path/to/VanityStudio
node skills/vanity-studio/scripts/studio.mjs sheet project.json preview.jpg --studio-root /path/to/VanityStudio
node skills/vanity-studio/scripts/studio.mjs frame project.json detail.png --t 2.4 --studio-root /path/to/VanityStudio
# Open the images, correct defects, regenerate and inspect the affected previews.
node skills/vanity-studio/scripts/studio.mjs review-approve project.json --notes "Describe the actual scene checks and corrections."
node skills/vanity-studio/scripts/studio.mjs render project.json final.mp4 --studio-root /path/to/VanityStudio
```

Media paths are relative to the composition JSON file. The editor's `docs` and `spec` commands provide the current composition fields and supported effects; the skill does not duplicate the engine or its documentation.

## Generated assets and review

Register successful generated files with `asset-add`. The adapter blocks final rendering when a registered asset is unused unless it has been inspected and rejected for a concrete quality defect. An included derived clip also accounts for its registered source still. The workflow uses contact sheets and detailed frames to review composition and subtitles before exporting.

Available image/video generation tools, including Gemini, are welcome when they improve the concept; the calling agent supplies them and respects the user's budget. Inspect generated results and account for their use.

Final export also requires a current contact sheet covering every editor review sample, a full-size detail frame and explicit visual-review findings. Missing previews, automatic composition errors, changed preview files, or changes to the document or local source media invalidate review and block export. Review records are saved beside the document and final output. The agent must correct visible issues, including text overflowing cards, before approving.

The adapter cannot discover assets that the agent fails to register, judge aesthetics independently, prove the agent opened an image, detect changed contents behind a remote URL, or enforce its checks when the editor's renderer is invoked directly. A clean automatic report does not prove card containment or good composition. See [the skill](skills/vanity-studio/SKILL.md) for the complete workflow.

## Verify the adapter

```sh
node --test
```

The tests use temporary fixtures and a fake renderer. They require `ffprobe` but no editor, model API, account, or generated video.
