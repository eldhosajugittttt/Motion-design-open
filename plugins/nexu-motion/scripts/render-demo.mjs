import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recorder = path.join(root, 'skills', 'nexu-motion', 'scripts', 'record-page.mjs');
const input = path.join(root, 'skills', 'nexu-motion', 'assets', 'starter', 'index.html');
const outputDir = path.join(root, 'work', 'demo');
await mkdir(outputDir, {recursive: true});

await run(process.execPath, [
  recorder,
  '--input', input,
  '--output', path.join(outputDir, 'poster.png'),
  '--width', '720', '--height', '1280', '--fps', '30', '--frame', '75',
]);
await run(process.execPath, [
  recorder,
  '--input', input,
  '--output', path.join(outputDir, 'nexu-motion-demo.mp4'),
  '--width', '720', '--height', '1280', '--fps', '30', '--duration', '3.5',
]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: 'inherit'});
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Demo step exited with ${code}`)));
  });
}
