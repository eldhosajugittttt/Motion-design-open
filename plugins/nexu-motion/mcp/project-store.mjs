import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SUPPORTED_ELEMENT_TYPES = new Set(['text', 'shape', 'image']);
const SUPPORTED_ANIMATION_PROPERTIES = new Set([
  'x',
  'y',
  'scale',
  'rotation',
  'opacity',
  'blur',
]);

export function slugify(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || `motion-${Date.now()}`;
}

export function projectsRoot() {
  return path.resolve(
    process.env.NEXU_MOTION_PROJECTS_DIR || path.join(process.cwd(), 'work', 'projects'),
  );
}

export function projectDir(projectId) {
  if (!SAFE_ID.test(projectId)) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
  return path.join(projectsRoot(), projectId);
}

export function projectPath(projectId) {
  return path.join(projectDir(projectId), 'project.json');
}

export async function createProject(input) {
  const width = integerInRange(input.width ?? 1080, 160, 7680, 'width');
  const height = integerInRange(input.height ?? 1920, 160, 7680, 'height');
  const fps = integerInRange(input.fps ?? 30, 1, 120, 'fps');
  const durationSeconds = numberInRange(
    input.durationSeconds ?? 6,
    0.1,
    600,
    'durationSeconds',
  );
  const baseId = slugify(input.projectId || input.name || 'motion');
  const projectId = await availableId(baseId);
  const project = {
    schemaVersion: 1,
    id: projectId,
    name: String(input.name || 'Untitled motion'),
    brief: String(input.brief || ''),
    width,
    height,
    fps,
    durationFrames: Math.max(1, Math.round(durationSeconds * fps)),
    background: {type: 'solid', color: '#09090b'},
    scenes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  validateProject(project);
  await saveProject(project);
  return project;
}

export async function getProject(projectId) {
  const raw = await readFile(projectPath(projectId), 'utf8');
  const project = JSON.parse(raw);
  validateProject(project);
  return project;
}

export async function saveProject(project) {
  validateProject(project);
  project.updatedAt = new Date().toISOString();
  const dir = projectDir(project.id);
  await mkdir(dir, {recursive: true});
  await writeFile(projectPath(project.id), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  return project;
}

export async function setComposition(projectId, composition) {
  const project = await getProject(projectId);
  if (composition.name !== undefined) project.name = String(composition.name);
  if (composition.brief !== undefined) project.brief = String(composition.brief);
  if (composition.background !== undefined) project.background = composition.background;
  if (composition.scenes !== undefined) project.scenes = composition.scenes;
  if (composition.durationFrames !== undefined) {
    project.durationFrames = integerInRange(
      composition.durationFrames,
      1,
      72000,
      'durationFrames',
    );
  }
  validateProject(project);
  return saveProject(project);
}

export async function listProjects() {
  await mkdir(projectsRoot(), {recursive: true});
  const entries = await readdir(projectsRoot(), {withFileTypes: true});
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !SAFE_ID.test(entry.name)) continue;
    try {
      const project = await getProject(entry.name);
      projects.push({
        id: project.id,
        name: project.name,
        width: project.width,
        height: project.height,
        fps: project.fps,
        durationFrames: project.durationFrames,
        updatedAt: project.updatedAt,
      });
    } catch {
      // Ignore folders that are not valid Nexu Motion projects.
    }
  }
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function validateProject(project) {
  assertObject(project, 'project');
  if (project.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (!SAFE_ID.test(project.id)) throw new Error('project.id must be a safe slug');
  integerInRange(project.width, 160, 7680, 'project.width');
  integerInRange(project.height, 160, 7680, 'project.height');
  integerInRange(project.fps, 1, 120, 'project.fps');
  integerInRange(project.durationFrames, 1, 72000, 'project.durationFrames');
  validateBackground(project.background, 'project.background');
  if (!Array.isArray(project.scenes)) throw new Error('project.scenes must be an array');

  const ids = new Set();
  project.scenes.forEach((scene, sceneIndex) => {
    const label = `project.scenes[${sceneIndex}]`;
    assertObject(scene, label);
    requiredId(scene.id, `${label}.id`, ids);
    integerInRange(scene.startFrame, 0, project.durationFrames - 1, `${label}.startFrame`);
    integerInRange(scene.durationFrames, 1, project.durationFrames, `${label}.durationFrames`);
    if (scene.startFrame + scene.durationFrames > project.durationFrames) {
      throw new Error(`${label} extends beyond project.durationFrames`);
    }
    validateBackground(scene.background ?? project.background, `${label}.background`);
    if (!Array.isArray(scene.elements)) throw new Error(`${label}.elements must be an array`);
    scene.elements.forEach((element, elementIndex) => {
      validateElement(element, `${label}.elements[${elementIndex}]`, ids, scene.durationFrames);
    });
  });
  return project;
}

function validateElement(element, label, ids, sceneDurationFrames) {
  assertObject(element, label);
  requiredId(element.id, `${label}.id`, ids);
  if (!SUPPORTED_ELEMENT_TYPES.has(element.type)) {
    throw new Error(`${label}.type must be text, shape, or image`);
  }
  numberInRange(element.x ?? 0, -20000, 20000, `${label}.x`);
  numberInRange(element.y ?? 0, -20000, 20000, `${label}.y`);
  numberInRange(element.width ?? 100, 0, 20000, `${label}.width`);
  numberInRange(element.height ?? 100, 0, 20000, `${label}.height`);
  integerInRange(element.startFrame ?? 0, 0, sceneDurationFrames, `${label}.startFrame`);
  integerInRange(
    element.endFrame ?? sceneDurationFrames,
    0,
    sceneDurationFrames,
    `${label}.endFrame`,
  );
  if (element.type === 'text' && typeof element.text !== 'string') {
    throw new Error(`${label}.text must be a string`);
  }
  if (element.type === 'image' && typeof element.src !== 'string') {
    throw new Error(`${label}.src must be a local path, file URL, or data URL`);
  }
  if (element.type === 'shape' && !element.fill) {
    throw new Error(`${label}.fill is required for shapes`);
  }
  if (element.animations !== undefined && !Array.isArray(element.animations)) {
    throw new Error(`${label}.animations must be an array`);
  }
  for (const [index, animation] of (element.animations || []).entries()) {
    const animationLabel = `${label}.animations[${index}]`;
    assertObject(animation, animationLabel);
    if (!SUPPORTED_ANIMATION_PROPERTIES.has(animation.property)) {
      throw new Error(
        `${animationLabel}.property must be one of ${[...SUPPORTED_ANIMATION_PROPERTIES].join(', ')}`,
      );
    }
    if (!Number.isFinite(animation.from) || !Number.isFinite(animation.to)) {
      throw new Error(`${animationLabel}.from and .to must be finite numbers`);
    }
    integerInRange(animation.startFrame ?? 0, 0, sceneDurationFrames, `${animationLabel}.startFrame`);
    integerInRange(animation.durationFrames, 1, sceneDurationFrames, `${animationLabel}.durationFrames`);
  }
}

function validateBackground(background, label) {
  assertObject(background, label);
  if (background.type === 'solid') {
    if (typeof background.color !== 'string') throw new Error(`${label}.color is required`);
    return;
  }
  if (background.type === 'linear-gradient') {
    if (!Array.isArray(background.colors) || background.colors.length < 2) {
      throw new Error(`${label}.colors must contain at least two colors`);
    }
    return;
  }
  throw new Error(`${label}.type must be solid or linear-gradient`);
}

function requiredId(value, label, ids) {
  if (!value || typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new Error(`${label} must be a safe slug`);
  }
  if (ids.has(value)) throw new Error(`${label} duplicates id "${value}"`);
  ids.add(value);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function integerInRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function numberInRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}`);
  }
  return value;
}

async function availableId(baseId) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const id = attempt === 0 ? baseId : `${baseId}-${attempt + 1}`.slice(0, 64);
    try {
      await readFile(projectPath(id));
    } catch (error) {
      if (error?.code === 'ENOENT') return id;
      throw error;
    }
  }
  throw new Error('Could not allocate a unique project id');
}
