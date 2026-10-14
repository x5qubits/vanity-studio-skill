import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const installer = resolve('tools/install.mjs');
const adapter = resolve('skills/vanity-studio/scripts/studio.mjs');

test('the installer copies only the skill; the installed adapter reaches a separately supplied editor', () => {
  const folder = mkdtempSync(join(tmpdir(), 'studio access '));
  try {
    const editor = join(folder, 'private editor');
    const codexHome = join(folder, 'codex home');
    mkdirSync(join(editor, 'tools'), { recursive: true });
    writeFileSync(join(editor, 'tools/render.mjs'), 'console.log(JSON.stringify({ok: true, args: process.argv.slice(2)}));');
    writeFileSync(join(editor, 'private-source.txt'), 'must stay in the editor');
    const result = spawnSync(process.execPath, [installer, '--agent', 'codex', '--studio-root', editor], {
      cwd: folder, env: { ...process.env, CODEX_HOME: codexHome }, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    const installed = join(codexHome, 'skills/vanity-studio');
    assert.deepEqual(readdirSync(installed).sort(), ['SKILL.md', 'agents', 'scripts', 'studio-root.json']);
    assert.equal(existsSync(join(installed, 'private-source.txt')), false);
    assert.equal(existsSync(join(installed, 'tools')), false);
    assert.equal(JSON.parse(readFileSync(join(installed, 'studio-root.json'), 'utf8')).root, editor);
    const call = spawnSync(process.execPath, [join(installed, 'scripts/studio.mjs'), 'docs'], {
      cwd: folder, env: { ...process.env, VANITY_STUDIO_ROOT: '' }, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(call.status, 0, call.stderr);
    assert.deepEqual(JSON.parse(call.stdout).args, ['docs']);
    const explicit = spawnSync(process.execPath, [adapter, 'frame', 'project.json', 'out.png', '--t', '2.4', '--studio-root', editor], {
      cwd: folder, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(explicit.status, 0, explicit.stderr);
    assert.deepEqual(JSON.parse(explicit.stdout).args, ['frame', 'project.json', 'out.png', '--t', '2.4']);
    const invalid = spawnSync(process.execPath, [installer, '--agent', 'codex', '--studio-root', join(folder, 'missing')], {
      env: { ...process.env, CODEX_HOME: join(folder, 'untouched') }, encoding: 'utf8', windowsHide: true,
    });
    assert.equal(invalid.status, 1);
    assert.equal(existsSync(join(folder, 'untouched')), false);
  } finally {
    const target = resolve(folder);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('studio access '));
    rmSync(target, { recursive: true, force: true });
  }
});
