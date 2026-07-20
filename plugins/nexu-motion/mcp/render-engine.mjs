import {access, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPlayerHtml} from './player-template.mjs';
import {projectDir} from './project-store.mjs';

const CHROME_CANDIDATES = [
  process.env.NEXU_MOTION_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export async function previewFrame(project, options = {}) {
  const frame = resolveFrame(project, options);
  const outputName = safeOutputName(options.outputName || `preview-${String(frame).padStart(6, '0')}.png`, '.png');
  const outputPath = path.join(projectDir(project.id), outputName);
  await mkdir(projectDir(project.id), {recursive: true});
  const playerPath = await writePlayer(project);
  const browser = await openRenderer(project, playerPath);
  try {
    const data = await browser.capture(frame);
    await writeFile(outputPath, data);
  } finally {
    await browser.close();
  }
  return {frame, outputPath};
}

export async function renderVideo(project, options = {}) {
  const outputName = safeOutputName(options.outputName || `${project.id}.mp4`, '.mp4');
  const outputPath = path.join(projectDir(project.id), outputName);
  const framesDir = await mkdtemp(path.join(projectDir(project.id), '.render-'));
  const playerPath = await writePlayer(project);
  const browser = await openRenderer(project, playerPath);
  try {
    for (let frame = 0; frame < project.durationFrames; frame += 1) {
      const data = await browser.capture(frame);
      const framePath = path.join(framesDir, `frame-${String(frame).padStart(6, '0')}.png`);
      await writeFile(framePath, data);
      options.onProgress?.({frame: frame + 1, total: project.durationFrames});
    }
  } finally {
    await browser.close();
  }
  try {
    await runProcess('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(project.fps),
      '-i',
      path.join(framesDir, 'frame-%06d.png'),
      '-c:v',
      'libx264',
      '-preset',
      options.preset || 'medium',
      '-crf',
      String(options.crf ?? 18),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  } finally {
    await rm(framesDir, {recursive: true, force: true});
  }
  return {outputPath, frames: project.durationFrames, fps: project.fps};
}

async function writePlayer(project) {
  const runtimeDir = path.join(projectDir(project.id), '.nexu');
  const playerPath = path.join(runtimeDir, 'player.html');
  await mkdir(runtimeDir, {recursive: true});
  await writeFile(playerPath, createPlayerHtml(project), 'utf8');
  return playerPath;
}

async function openRenderer(project, playerPath) {
  const chromePath = await findChrome();
  const profileDir = await mkdtemp(path.join(projectDir(project.id), '.chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--allow-file-access-from-files',
    '--remote-allow-origins=*',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});

  const browserWs = await waitForDevTools(chrome);
  const browserUrl = new URL(browserWs);
  const baseUrl = `http://${browserUrl.hostname}:${browserUrl.port}`;
  const targetResponse = await fetch(`${baseUrl}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
  });
  if (!targetResponse.ok) {
    chrome.kill('SIGTERM');
    throw new Error(`Chrome target creation failed: ${targetResponse.status}`);
  }
  const target = await targetResponse.json();
  const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: project.width,
    height: project.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const url = `${pathToFileURL(playerPath).href}?v=${Date.now()}`;
  await cdp.send('Page.navigate', {url});
  await waitUntilReady(cdp);

  return {
    async capture(frame) {
      await cdp.send('Runtime.evaluate', {
        expression: `window.__NEXU_RENDER_FRAME(${JSON.stringify(frame)})`,
        awaitPromise: true,
        returnByValue: true,
      });
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      return Buffer.from(screenshot.data, 'base64');
    },
    async close() {
      cdp.close();
      if (!chrome.killed) {
        const exited = new Promise((resolve) => chrome.once('exit', resolve));
        chrome.kill('SIGTERM');
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1200))]);
      }
      await rm(profileDir, {recursive: true, force: true, maxRetries: 6, retryDelay: 120});
    },
  };
}

async function waitUntilReady(cdp) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'Boolean(window.__NEXU_RENDER_FRAME && window.__NEXU_READY)',
      returnByValue: true,
    });
    if (result.result?.value) {
      const ready = await cdp.send('Runtime.evaluate', {
        expression: 'window.__NEXU_READY.then(() => true)',
        awaitPromise: true,
        returnByValue: true,
      });
      if (ready.result?.value) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('The local player did not become ready');
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }
  throw new Error(
    'Chrome/Chromium was not found. Set NEXU_MOTION_CHROME to the browser executable path.',
  );
}

function waitForDevTools(chrome) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => {
      chrome.kill('SIGTERM');
      reject(new Error(`Chrome did not expose DevTools. ${stderr.slice(-800)}`));
    }, 15000);
    chrome.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    chrome.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    chrome.once('exit', (code) => {
      if (code !== null && !stderr.match(/DevTools listening on/)) {
        clearTimeout(timeout);
        reject(new Error(`Chrome exited with code ${code}. ${stderr.slice(-800)}`));
      }
    });
  });
}

function resolveFrame(project, options) {
  if (options.frame !== undefined) {
    return Math.max(0, Math.min(project.durationFrames - 1, Math.round(options.frame)));
  }
  const seconds = Number(options.timeSeconds ?? 0);
  return Math.max(0, Math.min(project.durationFrames - 1, Math.round(seconds * project.fps)));
}

function safeOutputName(value, extension) {
  const name = path.basename(String(value));
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(name)) {
    throw new Error('outputName may contain only letters, numbers, dots, dashes, and underscores');
  }
  return name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`;
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error('Chrome DevTools connection closed'));
      }
      this.pending.clear();
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new CdpClient(socket)), {once: true});
      socket.addEventListener('error', () => reject(new Error('Could not connect to Chrome DevTools')), {
        once: true,
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }

  close() {
    this.socket.close();
  }
}
