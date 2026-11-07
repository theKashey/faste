// Installs the packed tarball into an empty project and uses it the way a consumer does.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  // a Node that does not detect ES modules takes these directories for CommonJS without the mark
  for (const directory of ['es2015', 'es2019']) {
    const manifest = join(consumer, 'node_modules/faste/dist', directory, 'package.json');

    if (JSON.parse(readFileSync(manifest, 'utf8')).type !== 'module') {
      throw new Error(`dist/${directory} is not marked as ES modules`);
    }
  }

  const check = `
    m.setFasteDebug(false);
    const log = [];
    const signals = [];
    const machine = m
      .faste()
      .withPhases(['a', 'b'])
      .withMessages(['go'])
      .withSignals(['out'])
      .on('go', ['a'], ({ transitTo }) => transitTo('b'))
      .on('@enter', ['b'], ({ emit }) => emit('out', 1, 2))
      .on('@enter', (_, __, phase) => log.push('enter ' + phase))
      .hooks({
        go: () => {
          log.push('hook on');
          return () => log.push('hook off');
        },
      })
      .create();

    machine.connect((...args) => signals.push(args.join()));
    machine.start('a');
    machine.put('go');
    machine.destroy();
    machine.start('a');
    machine.destroy();
    machine.start('a');

    const seen = [log.join(), signals.join(' '), machine.phase()].join(' | ');
    const expected = 'hook on,enter a,hook off,enter b,hook on,enter a,hook off,hook on,enter a | out,1,2 | a';

    if (seen !== expected) {
      throw new Error('expected ' + expected + ', saw ' + seen);
    }
  `;

  for (const entry of ['faste', 'faste/dist/es5', 'faste/dist/es5/index', 'faste/dist/es5/index.js']) {
    run('node', ['-e', `const m = require('${entry}'); ${check}`]);
  }

  for (const entry of [
    'faste',
    'faste/dist/es2015',
    'faste/dist/es2015/index',
    'faste/dist/es2015/index.js',
    'faste/dist/es2019',
    'faste/dist/es2019/index',
    'faste/dist/es2019/index.js',
  ]) {
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
