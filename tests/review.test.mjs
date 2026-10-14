import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const adapter = resolve('skills/vanity-studio/scripts/studio.mjs');
const notes = 'Opened every scene preview and detail frame; verified card padding, wrapping, readability and one caption track.';
function fixture(fn) {
  const folder = mkdtempSync(join(tmpdir(), 'studio review '));
  try {
    const editor = join(folder, 'editor');
    mkdirSync(join(editor, 'tools'), { recursive: true });
    const scenario = join(editor, 'scenario.json');
    const calls = join(editor, 'calls.jsonl');
    writeFileSync(scenario, '{}');
    writeFileSync(join(editor, 'tools/render.mjs'), `
      import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
      const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const args=process.argv.slice(2), op=args[0];
      fs.appendFileSync(path.join(root,'calls.jsonl'), JSON.stringify(args)+'\\n');
      const scenario=JSON.parse(fs.readFileSync(path.join(root,'scenario.json'),'utf8'));
      const quality={ok:!scenario.errors?.length, errors:scenario.errors||[], warnings:[], times:[.6,1.2,1.7]};
      if(scenario.missingQuality) delete quality.ok;
      const file=path.resolve(args[2]);
      fs.writeFileSync(file, op+' fixture');
      const i=args.indexOf('--times');
      const times=i>=0?args[i+1].split(',').map(Number):quality.times;
      console.log(JSON.stringify({ok:true,file,quality,times,duration:2,bytes:10}));
    `);
    const doc = join(folder, 'project.json');
    const media = join(folder, 'source.png');
    writeFileSync(doc, JSON.stringify({ scenes: [{ image: 'source.png', dur: 2 }] }));
    writeFileSync(media, 'media fixture');
    const output = join(folder, 'final.mp4');
    const sheet = join(folder, 'sheet.jpg');
    const frame = join(folder, 'detail.png');
    const call = (...args) => {
      const r = spawnSync(process.execPath, [adapter, ...args, '--studio-root', editor], {
        cwd: folder, encoding: 'utf8', windowsHide: true,
      });
      return { status: r.status, data: JSON.parse(r.stdout || '{}'), stderr: r.stderr };
    };
    const prepare = () => {
      assert.equal(call('sheet', doc, sheet).status, 0);
      assert.equal(call('frame', doc, frame, '--t', '1.2').status, 0);
    };
    const approve = () => call('review-approve', doc, '--notes', notes);
    const renders = () => existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').filter(v => JSON.parse(v)[0] === 'render').length : 0;
    fn({ folder, doc, media, output, sheet, frame, scenario, call, prepare, approve, renders });
  } finally {
    const target = resolve(folder);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('studio review '));
    rmSync(target, { recursive: true, force: true });
  }
}

test('export is blocked without current previews and explicit visual review', () => fixture(({ doc, output, call, prepare, renders }) => {
  assert.equal(call('render', doc, output).status, 1);
  prepare();
  assert.match(call('render', doc, output).data.errors[0], /review-approve/);
  assert.equal(renders(), 0);
  assert.equal(existsSync(output), false);
}));

test('composition errors and missing quality reports prevent approval and export', () => fixture(({ doc, output, scenario, call, prepare, approve, renders }) => {
  writeFileSync(scenario, JSON.stringify({ errors: ['scene 1: Multiple subtitle layers are visible together.'] }));
  prepare();
  assert.match(approve().data.errors[0], /Multiple subtitle layers/);
  assert.equal(call('render', doc, output).status, 1);
  writeFileSync(scenario, JSON.stringify({ missingQuality: true }));
  prepare();
  assert.match(approve().data.errors[0], /did not return composition checks/);
  assert.equal(renders(), 0);
}));

test('a reviewed composition exports audits; editing the doc or media blocks subsequent export', () => fixture(({ doc, media, output, call, prepare, approve, renders }) => {
  prepare();
  assert.equal(approve().status, 0);
  const result = call('render', doc, output);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(result.data.reviewAudit)).approval.notes, notes);
  assert.ok(existsSync(result.data.assetAudit));
  assert.equal(renders(), 1);
  writeFileSync(media, 'changed generated media');
  assert.match(call('render', doc, output).data.errors[0], /changes invalidate review/);
  prepare();
  assert.equal(approve().status, 0);
  const changed = JSON.parse(readFileSync(doc, 'utf8'));
  changed.scenes[0].dur = 3;
  writeFileSync(doc, JSON.stringify(changed));
  assert.equal(call('render', doc, output).status, 1);
  assert.equal(renders(), 1);
}));

test('altered preview images invalidate approval', () => fixture(({ doc, sheet, output, call, prepare, approve, renders }) => {
  prepare();
  assert.equal(approve().status, 0);
  writeFileSync(sheet, 'another preview image');
  assert.match(call('render', doc, output).data.errors[0], /preview is missing or changed/);
  assert.equal(renders(), 0);
}));

test('review needs all scene sample times and a full-size detail frame', () => fixture(({ doc, sheet, frame, call, approve }) => {
  assert.equal(call('sheet', doc, sheet, '--times', '.6').status, 0);
  assert.equal(call('frame', doc, frame, '--scale', '.25').status, 0);
  assert.match(approve().data.errors[0], /every composition review sample/);
  assert.equal(call('sheet', doc, sheet).status, 0);
  assert.match(approve().data.errors[0], /full-size frame/);
  assert.equal(call('frame', doc, frame).status, 0);
  assert.equal(approve().status, 0);
}));
