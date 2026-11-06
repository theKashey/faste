// Installs the packed tarball into an empty project and uses it the way a consumer does.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const consumer = mkdtempSync(join(tmpdir(), 'faste-consumer-'));
const run = (file, args, cwd = consumer) => execFileSync(file, args, { cwd, stdio: 'inherit' });
const tsc = join(root, 'node_modules/.bin/tsc');

const usage = (entry) => `import { faste, setFasteDebug } from '${entry}';
setFasteDebug(false);
const machine = faste()
  .withPhases(['a', 'b'])
  .withMessages(['go'])
  .withState({ n: 1 })
  .withMessageArguments<{ go: [step: number] }>()
  .on('go', ['a'], ({ transitTo }, step) => transitTo(step > 0 ? 'b' : 'a'))
  .create()
  .start('a');
machine.put('go', 1);
`;

try {
  run('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', consumer], root);
  const [tarball] = readdirSync(consumer).filter((file) => file.endsWith('.tgz'));

  writeFileSync(join(consumer, 'package.json'), '{"private":true}');
  run('npm', ['install', '--silent', '--no-audit', '--no-fund', `./${tarball}`]);

  const check = "if (typeof m.faste !== 'function' || typeof m.setFasteDebug !== 'function') process.exit(1);";

  for (const entry of ['faste', 'faste/dist/es5', 'faste/dist/es5/index.js']) {
    run('node', ['-e', `const m = require('${entry}'); ${check}`]);
  }

  for (const entry of ['faste', 'faste/dist/es2015', 'faste/dist/es2015/index.js']) {
    run('node', ['--input-type=module', '-e', `import * as m from '${entry}'; ${check}`]);
  }

  writeFileSync(join(consumer, 'use.ts'), usage('faste'));

  for (const [module, moduleResolution] of [
    ['nodenext', 'nodenext'],
    ['esnext', 'bundler'],
  ]) {
    run(tsc, [
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      'false',
      '--target',
      'es2020',
      '--module',
      module,
      '--moduleResolution',
      moduleResolution,
      'use.ts',
    ]);
  }

  console.log('package check passed');
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
