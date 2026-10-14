#!/usr/bin/env node
// Portable skill adapter to the existing renderer, with an explicit generated-asset inventory.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
  return args.splice(i, 2)[1];
};
const read = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const key = (file) => process.platform === 'win32' ? resolve(file).toLowerCase() : resolve(file);
const local = (value, base) => typeof value === 'string' && !/^(https?:|data:|blob:|media:|job:)/i.test(value) ? resolve(base, value) : null;
const emit = (data) => console.log(JSON.stringify(data));
const fail = (message) => { emit({ ok: false, errors: [message] }); process.exitCode = 1; };

function editorRoot(explicit) {
  if (explicit || process.env.VANITY_STUDIO_ROOT) {
    const root = resolve(explicit || process.env.VANITY_STUDIO_ROOT);
    if (!existsSync(join(root, 'tools', 'render.mjs'))) throw new Error(`No Studio CLI under ${root}`);
    return root;
  }
  const candidates = [resolve(here, '../../..')];
  const installed = join(here, '..', 'studio-root.json');
  if (existsSync(installed)) candidates.push(read(installed).root);
  for (let folder = process.cwd(), n = 0; n < 8; n++, folder = dirname(folder)) candidates.push(folder, join(folder, 'VanityStudio'));
  const found = candidates.find(p => p && existsSync(join(p, 'tools', 'render.mjs')));
  if (!found) throw new Error('Set VANITY_STUDIO_ROOT or pass --studio-root pointing to the VanityStudio checkout.');
  return resolve(found);
}

function refs(doc, base) {
  const used = new Set();
  const add = v => { const p = local(v, base); if (p) used.add(key(p)); };
  const layer = l => {
    if (!l || typeof l !== 'object') return;
    for (const k of ['image', 'video', 'src', 'model', 'rive']) add(l[k]);
    if (typeof l.lottie === 'string' && !l.lottie.trimStart().startsWith('{')) add(l.lottie);
    for (const c of l.children || []) layer(c);
  };
  for (const s of doc.scenes || doc.clips || []) {
    add(s.image); add(s.video);
    for (const l of s.layers || s.overlays || []) layer(l);
  }
  for (const l of doc.layers || []) layer(l);
  for (const a of doc.audio || doc.audios || []) add(a.src);
  return used;
}

function inventory(docPath) {
  const path = resolve(docPath) + '.assets.json';
  const data = existsSync(path) ? read(path) : { version: 1, assets: [] };
  if (data.version !== 1 || !Array.isArray(data.assets)) throw new Error(`Invalid asset inventory: ${path}`);
  const save = () => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(data, null, 2)); };
  const full = value => resolve(dirname(resolve(docPath)), value);
  const find = value => data.assets.find(a => key(full(a.file)) === key(full(value)));
  return { path, data, save, full, find };
}

function enforce(docPath) {
  const inv = inventory(docPath);
  const used = refs(read(docPath), dirname(resolve(docPath)));
  let changed;
  do {
    changed = false;
    for (const a of inv.data.assets) if (used.has(key(inv.full(a.file))) && a.source) {
      const parent = key(inv.full(a.source));
      if (!used.has(parent)) { used.add(parent); changed = true; }
    }
  } while (changed);
  const missing = inv.data.assets.filter(a => !used.has(key(inv.full(a.file))) &&
    !(a.rejection && existsSync(inv.full(a.file)) && a.rejection.hash === hash(inv.full(a.file))));
  if (missing.length) throw new Error(`Render blocked: generated assets are unused: ${missing.map(a => a.file).join(', ')}. Include them or inspect and reject them for specific quality defects. Tests and clip duration are not exemptions.`);
  return inv;
}

function invoke(root, argv, capture = false) {
  const result = spawnSync(process.execPath, [join(root, 'tools/render.mjs'), ...argv], {
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (capture) {
    const output = JSON.parse(result.stdout || '{}');
    if (result.status !== 0 || !output.ok) throw new Error((output.errors || ['Studio operation failed']).join('; '));
    return output;
  }
  process.exitCode = result.status ?? 1;
  return result;
}

try {
  const explicitRoot = take('--studio-root');
  const op = args[0];
  if (op === '--help' || !op) {
    console.log('studio.mjs docs|spec|validate|frame|sheet|render ... [--studio-root <editor>]\n' +
      'studio.mjs asset-add|asset-inspect|asset-reject <doc.json> <file> [--source <still> | --defect <quality defect> --reason <findings>]\n' +
      'studio.mjs assets <doc.json>');
  } else if (['asset-add', 'asset-inspect', 'asset-reject', 'assets'].includes(op)) {
    if (!args[1]) throw new Error(`${op} needs a doc path`);
    const source = take('--source'), defect = take('--defect'), reason = take('--reason');
    const inv = inventory(args[1]);
    if (op === 'assets') emit({ ok: true, manifest: inv.path, ...inv.data });
    else {
      if (!args[2] || !existsSync(inv.full(args[2]))) throw new Error('Give an existing generated file, relative to the doc or absolute.');
      const full = inv.full(args[2]), revision = hash(full);
      let asset = inv.find(args[2]);
      if (op === 'asset-add') {
        if (source && !existsSync(inv.full(source))) throw new Error('The source file does not exist.');
        if (source && key(inv.full(source)) === key(full)) throw new Error('An asset cannot be its own source.');
        if (!asset) { asset = { file: args[2], source: source || null }; inv.data.assets.push(asset); }
        else if (source) asset.source = source;
        inv.save(); emit({ ok: true, registered: asset.file, manifest: inv.path });
      } else {
        if (!asset) throw new Error('Register this generated file with asset-add first.');
        if (op === 'asset-reject') {
          if (!['blur', 'artifacts', 'distortion', 'wrong-content', 'wrong-motion', 'unreadable'].includes(defect)) throw new Error('Give an observed quality defect. A test or preference is not a quality defect.');
          if (!reason || reason.trim().length < 20) throw new Error('Give a specific quality reason of at least 20 characters.');
          if (!asset.inspection || asset.inspection.hash !== revision) throw new Error('Run asset-inspect on the current file and open the preview before rejecting it.');
          if (defect === 'unreadable' && !asset.inspection.decodeError) throw new Error('Unreadable requires a recorded decoder error.');
          if (defect !== 'unreadable' && asset.inspection.decodeError) throw new Error('No pixels could be decoded; use unreadable with the actual diagnostic.');
          asset.rejection = { defect, reason: reason.trim(), hash: revision, utc: new Date().toISOString() };
          inv.save(); emit({ ok: true, rejected: asset.file, reason: asset.rejection.reason });
        } else {
          const video = ['.mp4', '.webm', '.mov', '.m4v'].includes(extname(full).toLowerCase());
          let duration = 1;
          if (video) {
            const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', full], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
            if (probe.error) throw new Error('ffprobe is required for clip inspection: ' + probe.error.message);
            if (probe.status !== 0) {
              asset.inspection = { hash: revision, decodeError: (probe.stderr || 'ffprobe could not decode the clip').trim(), utc: new Date().toISOString() };
              inv.save(); throw new Error('Decoder failure recorded: ' + asset.inspection.decodeError + '. Reject with defect=unreadable.');
            }
            duration = Number(probe.stdout.trim());
            if (!Number.isFinite(duration) || duration <= 0) throw new Error('ffprobe did not return a positive clip duration.');
          }
          const folder = resolve(dirname(inv.path), basename(args[1]) + '.asset-previews');
          mkdirSync(folder, { recursive: true });
          const stem = revision.slice(0, 12) + '-' + basename(full).replace(/[^a-zA-Z0-9._-]/g, '-');
          const previewDoc = join(folder, stem + '.json'), preview = join(folder, stem + '.jpg');
          writeFileSync(previewDoc, JSON.stringify({ format: 'reel', scenes: [{ [video ? 'video' : 'image']: full, dur: duration }] }));
          const times = video ? [0.01, duration * .25, duration * .5, duration * .75, Math.max(.01, duration - .01)] : [.5];
          const result = invoke(editorRoot(explicitRoot), ['sheet', previewDoc, preview, '--times', times.join(','), '--cols', '3'], true);
          if (hash(full) !== revision) throw new Error('The asset changed during inspection; inspect it again.');
          asset.inspection = { hash: revision, preview: result.file, times, utc: new Date().toISOString() };
          inv.save(); emit({ ...result, asset: asset.file, instruction: 'Open this preview before judging quality. Use the asset unless a concrete defect makes it unusable.' });
        }
      }
    }
  } else if (op === 'render') {
    if (!args[1] || !args[2]) throw new Error('render needs a doc and output path');
    const inv = enforce(args[1]);
    const result = invoke(editorRoot(explicitRoot), args, true);
    const audit = result.file + '.assets.json';
    writeFileSync(audit, JSON.stringify(inv.data, null, 2));
    emit({ ...result, assetAudit: audit });
  } else invoke(editorRoot(explicitRoot), args);
} catch (error) { fail(error.message); }
