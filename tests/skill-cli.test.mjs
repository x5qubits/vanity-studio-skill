import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const helper = resolve('skills/vanity-studio/scripts/studio.mjs');
function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'studio skill '));
  try {
    const doc = join(root, 'project.json');
    writeFileSync(doc, JSON.stringify({ scenes: [{ image: 'still.png', dur: 2 }] }));
    writeFileSync(join(root, 'still.png'), 'still fixture');
    writeFileSync(join(root, 'clip.mp4'), 'invalid clip fixture');
    const call = (...args) => {
      const r = spawnSync(process.execPath, [helper, ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
      return { status: r.status, result: JSON.parse(r.stdout) };
    };
    fn({ root, doc, call });
  } finally {
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('studio skill '));
    rmSync(target, { recursive: true, force: true });
  }
}

test('unused generated clip blocks export without starting the renderer', () => fixture(({ doc, call }) => {
  assert.equal(call('asset-add', doc, 'clip.mp4').status, 0);
  const blocked = call('render', doc, 'out.mp4', '--studio-root', '/missing-editor');
  assert.equal(blocked.status, 1);
  assert.match(blocked.result.errors[0], /generated assets are unused: clip.mp4/);
}));

test('included footage consumes its registered source and nested video refs work', () => fixture(({ doc, call }) => {
  call('asset-add', doc, 'still.png');
  call('asset-add', doc, 'clip.mp4', '--source', 'still.png');
  writeFileSync(doc, JSON.stringify({ scenes: [{ card: '', dur: 2, layers: [{ kind: 'group', children: [{ kind: 'video', video: 'clip.mp4' }] }] }] }));
  const reachedRenderer = call('render', doc, 'out.mp4', '--studio-root', '/missing-editor');
  assert.match(reachedRenderer.result.errors[0], /No Studio CLI/);
}));

test('rejection cannot bypass inspection or use an experiment as a defect', () => fixture(({ doc, call }) => {
  call('asset-add', doc, 'clip.mp4');
  const uninspected = call('asset-reject', doc, 'clip.mp4', '--defect', 'blur', '--reason', 'The subject is visibly blurred beyond recognition.');
  assert.match(uninspected.result.errors[0], /asset-inspect/);
  const experiment = call('asset-reject', doc, 'clip.mp4', '--defect', 'test', '--reason', 'I made this only as an experiment and prefer a still.');
  assert.equal(experiment.status, 1);
  assert.match(experiment.result.errors[0], /quality defect/);
}));

test('actual decoder failure permits rejection; replacing the file invalidates it', () => fixture(({ root, doc, call }) => {
  call('asset-add', doc, 'clip.mp4');
  const inspection = call('asset-inspect', doc, 'clip.mp4');
  assert.equal(inspection.status, 1);
  assert.match(inspection.result.errors[0], /Decoder failure recorded/);
  assert.equal(call('asset-reject', doc, 'clip.mp4', '--defect', 'unreadable', '--reason', 'ffprobe could not decode the generated clip because it contains invalid video data.').status, 0);
  assert.match(call('render', doc, 'out.mp4', '--studio-root', '/missing-editor').result.errors[0], /No Studio CLI/);
  writeFileSync(join(root, 'clip.mp4'), 'replaced fixture');
  assert.match(call('render', doc, 'out.mp4').result.errors[0], /generated assets are unused/);
  assert.equal(JSON.parse(readFileSync(doc + '.assets.json')).assets[0].rejection.defect, 'unreadable');
}));
