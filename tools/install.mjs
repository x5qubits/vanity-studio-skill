#!/usr/bin/env node
// Install access instructions and the adapter only. The editor is supplied separately.
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/vanity-studio');
const args = process.argv.slice(2);
const values = {};
try {
  if (args.includes('--help')) {
    console.log('node tools/install.mjs --agent codex|claude|both --studio-root <existing editor directory>');
  } else {
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i];
      if (!['--agent', '--studio-root'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--')) {
        throw new Error('Use --agent codex|claude|both and --studio-root <existing editor directory>.');
      }
      if (values[flag]) throw new Error(`Duplicate option: ${flag}`);
      values[flag] = args[i + 1];
    }
    const agent = values['--agent'] || 'codex';
    if (!['codex', 'claude', 'both'].includes(agent)) throw new Error('Agent must be codex, claude, or both.');
    const configured = values['--studio-root'] || process.env.VANITY_STUDIO_ROOT;
    if (!configured) throw new Error('Pass --studio-root pointing to your existing Vanity Studio installation.');
    const root = resolve(configured);
    if (!existsSync(join(root, 'tools/render.mjs'))) throw new Error(`Editor CLI not found: ${join(root, 'tools/render.mjs')}`);
    const version = Number(process.versions.node.split('.')[0]);
    if (version < 22) throw new Error('Node.js 22 or newer is required.');
    const agents = agent === 'both' ? ['codex', 'claude'] : [agent];
    const files = ['SKILL.md', 'agents/openai.yaml', 'scripts/studio.mjs'];
    const targets = agents.map(name => ({ name, path: name === 'codex'
      ? join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills', 'vanity-studio')
      : join(homedir(), '.claude', 'skills', 'vanity-studio') }));
    // Check all destinations before updating any installed skill.
    for (const { path } of targets) {
      if (resolve(path) === source) throw new Error('The install target must differ from the source skill.');
      if (existsSync(path)) {
        const entry = join(path, 'SKILL.md');
        if (!existsSync(entry) || !/^name:\s*vanity-studio\s*$/m.test(readFileSync(entry, 'utf8'))) {
          throw new Error(`Refusing to overwrite an unrelated directory: ${path}`);
        }
      }
    }
    for (const { name, path } of targets) {
      for (const file of files) {
        const target = join(path, file);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(source, file), target);
      }
      writeFileSync(join(path, 'studio-root.json'), JSON.stringify({ root }, null, 2) + '\n');
      console.log(JSON.stringify({ ok: true, agent: name, skill: path, editor: root }));
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
