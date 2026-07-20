#!/usr/bin/env node
import {access, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.input && !args.url) || !args.output) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const options = {
    inputUrl: args.url || pathToFileURL(path.resolve(args.input)).href,
    output: path.resolve(args.output),
    width: positiveInt(args.width || 1080, 'width'),
    height: positiveInt(args.height || 1920, 'height'),
    fps: positiveInt(args.fps || 30, 'fps'),
    duration: positiveNumber(args.duration || 6, 'duration'),
    frame: args.frame === undefined ? undefined : nonnegativeInt(args.frame, 'frame'),
    crf: args.crf === undefined ? 18 : nonnegativeInt(args.crf, 'crf'),
  };

  await mkdir(path.dirname(options.output), {recursive: true});
  if (options.frame !== undefined || options.output.toLowerCase().endsWith('.png')) {
    await renderStill(options);
  } else {
    await renderVideo(options);
  }
}

async function renderStill(settings) {
  const session = await launch(settings);
  try {
    const frame = settings.frame ?? 0;
    await writeFile(settings.output, await session.capture(frame));
    process.stderr.write(`Rendered frame ${frame}: ${settings.output}\n`);
  } finally {
    await session.close();
  }
}

async function renderVideo(settings) {
  const outputDir = path.dirname(settings.output);
  const framesDir = await mkdtemp(path.join(outputDir, '.nexu-frames-'));
  const totalFrames = Math.max(1, Math.round(settings.duration * settings.fps));
  const session = await launch(settings);
  try {
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const data = await session.capture(frame);
      await writeFile(path.join(framesDir, `frame-${String(frame).padStart(6, '0')}.png`), data);
      if (frame === 0 || (frame + 1) % settings.fps === 0 || frame + 1 === totalFrames) {
        process.stderr.write(`Captured ${frame + 1}/${totalFrames} frames\n`);
      }
    }
  } finally {
    await session.close();
  }
  try {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-framerate', String(settings.fps),
      '-i', path.join(framesDir, 'frame-%06d.png'),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(settings.crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', settings.output,
    ]);
    process.stderr.write(`Rendered video: ${settings.output}\n`);
  } finally {
    await rm(framesDir, {recursive: true, force: true});
  }
}

async function launch(settings) {
  const chromePath = await findChrome();
  const profileDir = await mkdtemp(path.join(path.dirname(settings.output), '.nexu-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--allow-file-access-from-files', '--remote-allow-origins=*',
    '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  const browserWs = await devToolsUrl(chrome);
  const browserUrl = new URL(browserWs);
  const response = await fetch(
    `http://${browserUrl.hostname}:${browserUrl.port}/json/new?${encodeURIComponent('about:blank')}`,
    {method: 'PUT'},
  );
  if (!response.ok) throw new Error(`Chrome target creation failed: ${response.status}`);
  const target = await response.json();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: settings.width, height: settings.height, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Page.navigate', {url: `${settings.inputUrl}${settings.inputUrl.includes('?') ? '&' : '?'}nexu=${Date.now()}`});
  await waitForPage(cdp);

  return {
    async capture(frame) {
      const evaluation = await cdp.send('Runtime.evaluate', {
        expression: `window.renderFrame(${frame}, ${settings.fps})`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (evaluation.exceptionDetails) {
        throw new Error(`renderFrame failed: ${evaluation.exceptionDetails.text || 'page exception'}`);
      }
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: false,
      });
      return Buffer.from(screenshot.data, 'base64');
    },
    async close() {
      cdp.close();
      if (!chrome.killed) {
        const exited = new Promise(resolve => chrome.once('exit', resolve));
        chrome.kill('SIGTERM');
        await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 1200))]);
      }
      await rm(profileDir, {recursive: true, force: true, maxRetries: 6, retryDelay: 120});
    },
  };
}

async function waitForPage(cdp) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const check = await cdp.send('Runtime.evaluate', {
      expression: 'typeof window.renderFrame === "function"', returnByValue: true,
    });
    if (check.result?.value) {
      const ready = await cdp.send('Runtime.evaluate', {
        expression: 'Promise.resolve(window.__NEXU_READY).then(() => true)',
        awaitPromise: true,
        returnByValue: true,
      });
      if (ready.result?.value) return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Page did not expose window.renderFrame(frame, fps) within 15 seconds');
}

async function findChrome() {
  const candidates = [
    process.env.NEXU_MOTION_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error('Chrome/Chromium not found. Set NEXU_MOTION_CHROME to its executable path.');
}

function devToolsUrl(chrome) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => {
      chrome.kill('SIGTERM');
      reject(new Error(`Chrome did not expose DevTools. ${stderr.slice(-600)}`));
    }, 15000);
    chrome.stderr.on('data', chunk => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    chrome.once('error', error => { clearTimeout(timeout); reject(error); });
    chrome.once('exit', code => {
      if (!stderr.includes('DevTools listening on')) {
        clearTimeout(timeout);
        reject(new Error(`Chrome exited with code ${code}. ${stderr.slice(-600)}`));
      }
    });
  });
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', code => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-1200)}`)));
  });
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (token === '--help' || token === '-h') { parsed.help = true; continue; }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = values[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function positiveInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer`);
  return number;
}
function nonnegativeInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${name} must be a non-negative integer`);
  return number;
}
function positiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} must be a positive number`);
  return number;
}

function printUsage() {
  process.stderr.write(`Nexu Motion page recorder\n\n` +
    `node record-page.mjs --input index.html --output video.mp4 --width 1080 --height 1920 --fps 30 --duration 6\n` +
    `node record-page.mjs --input index.html --output still.png --width 1080 --height 1920 --fps 30 --frame 90\n`);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.id = 1;
    this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new Cdp(socket)), {once: true});
      socket.addEventListener('error', () => reject(new Error('Could not connect to Chrome DevTools')), {once: true});
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }
  close() { this.socket.close(); }
}

await main();
