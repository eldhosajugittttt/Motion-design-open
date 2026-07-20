import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerHtml} from './player-template.mjs';
import {validateProject} from './project-store.mjs';

const project = {
  schemaVersion: 1,
  id: 'test-project',
  name: 'Test project',
  brief: '',
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 180,
  background: {type: 'solid', color: '#000000'},
  scenes: [{
    id: 'intro',
    startFrame: 0,
    durationFrames: 180,
    elements: [{
      id: 'headline',
      type: 'text',
      text: 'MOVE',
      x: 540,
      y: 960,
      width: 900,
      height: 240,
      animations: [{property: 'opacity', from: 0, to: 1, startFrame: 0, durationFrames: 20}],
    }],
  }],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

test('validates a minimal composition', () => {
  assert.equal(validateProject(structuredClone(project)).id, 'test-project');
});

test('rejects duplicate ids', () => {
  const invalid = structuredClone(project);
  invalid.scenes[0].elements[0].id = 'intro';
  assert.throws(() => validateProject(invalid), /duplicates id/);
});

test('builds a deterministic HTML player', () => {
  const html = createPlayerHtml(project);
  assert.match(html, /__NEXU_RENDER_FRAME/);
  assert.match(html, /MOVE/);
  assert.match(html, /canvas/);
});
