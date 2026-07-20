#!/usr/bin/env node
import readline from 'node:readline';
import {readFile} from 'node:fs/promises';
import {
  createProject,
  getProject,
  listProjects,
  setComposition,
} from './project-store.mjs';
import {previewFrame, renderVideo} from './render-engine.mjs';

const tools = [
  {
    name: 'create_project',
    description:
      'Create a new local Nexu Motion project. Use portrait 1080x1920 for stories/reels, square 1080x1080 for feeds, and landscape 1920x1080 for video.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {type: 'string', description: 'Human-readable project name.'},
        projectId: {type: 'string', description: 'Optional lower-case slug.'},
        brief: {type: 'string', description: 'The creative brief and intended message.'},
        width: {type: 'integer', minimum: 160, maximum: 7680, default: 1080},
        height: {type: 'integer', minimum: 160, maximum: 7680, default: 1920},
        fps: {type: 'integer', minimum: 1, maximum: 120, default: 30},
        durationSeconds: {type: 'number', minimum: 0.1, maximum: 600, default: 6},
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_composition',
    description:
      'Replace a project composition with timed scenes and elements. Positions use canvas pixels with x/y at the element center. Element frames are relative to the scene.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {type: 'string'},
        composition: {
          type: 'object',
          properties: {
            name: {type: 'string'},
            brief: {type: 'string'},
            durationFrames: {type: 'integer', minimum: 1, maximum: 72000},
            background: {$ref: '#/$defs/background'},
            scenes: {
              type: 'array',
              items: {$ref: '#/$defs/scene'},
            },
          },
          required: ['scenes'],
          additionalProperties: false,
        },
      },
      required: ['projectId', 'composition'],
      additionalProperties: false,
      $defs: sceneGraphDefs(),
    },
  },
  {
    name: 'get_project',
    description: 'Read the complete editable scene graph for a Nexu Motion project.',
    inputSchema: {
      type: 'object',
      properties: {projectId: {type: 'string'}},
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_projects',
    description: 'List Nexu Motion projects stored by this local plugin.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
  },
  {
    name: 'preview_frame',
    description:
      'Render a single PNG preview locally. Use this after composing and before rendering the full video.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {type: 'string'},
        frame: {type: 'integer', minimum: 0},
        timeSeconds: {type: 'number', minimum: 0},
        outputName: {type: 'string', description: 'Optional PNG filename.'},
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'render_video',
    description:
      'Render every frame locally and export an H.264 MP4. This can take time for long or high-resolution projects.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {type: 'string'},
        outputName: {type: 'string', description: 'Optional MP4 filename.'},
        crf: {type: 'integer', minimum: 0, maximum: 51, default: 18},
        preset: {
          type: 'string',
          enum: ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow'],
          default: 'medium',
        },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
];

const rl = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    sendError(null, -32700, 'Parse error');
    return;
  }
  if (!Object.hasOwn(request, 'id')) return handleNotification(request);
  try {
    const result = await handleRequest(request);
    send({jsonrpc: '2.0', id: request.id, result});
  } catch (error) {
    sendError(request.id, -32603, error?.message || String(error));
  }
});

async function handleRequest(request) {
  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: request.params?.protocolVersion || '2025-06-18',
        capabilities: {tools: {listChanged: false}},
        serverInfo: {name: 'nexu-motion', version: '0.2.0'},
        instructions:
          'Create a project, set a complete composition, preview key frames, refine if needed, and render the MP4. All work is local and deterministic.',
      };
    case 'ping':
      return {};
    case 'tools/list':
      return {tools};
    case 'tools/call':
      return callTool(request.params?.name, request.params?.arguments || {});
    default:
      throw new Error(`Method not found: ${request.method}`);
  }
}

function handleNotification(request) {
  if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') {
    return;
  }
}

async function callTool(name, input) {
  try {
    if (name === 'create_project') {
      const project = await createProject(input);
      return success({
        project,
        next: 'Use set_composition with a complete scene graph, then preview_frame.',
      });
    }
    if (name === 'set_composition') {
      const project = await setComposition(input.projectId, input.composition);
      return success({
        project,
        next: 'Preview at least one visually important frame before video export.',
      });
    }
    if (name === 'get_project') return success({project: await getProject(input.projectId)});
    if (name === 'list_projects') return success({projects: await listProjects()});
    if (name === 'preview_frame') {
      const project = await getProject(input.projectId);
      const result = await previewFrame(project, input);
      const data = await readFile(result.outputPath);
      return {
        content: [
          {type: 'text', text: JSON.stringify(result, null, 2)},
          {type: 'image', data: data.toString('base64'), mimeType: 'image/png'},
        ],
        structuredContent: result,
      };
    }
    if (name === 'render_video') {
      const project = await getProject(input.projectId);
      return success(await renderVideo(project, input));
    }
    return failure(`Unknown tool: ${name}`);
  } catch (error) {
    return failure(error?.message || String(error));
  }
}

function success(value) {
  return {
    content: [{type: 'text', text: JSON.stringify(value, null, 2)}],
    structuredContent: value,
  };
}

function failure(message) {
  return {content: [{type: 'text', text: message}], isError: true};
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendError(id, code, message) {
  send({jsonrpc: '2.0', id, error: {code, message}});
}

function sceneGraphDefs() {
  return {
    background: {
      oneOf: [
        {
          type: 'object',
          properties: {type: {const: 'solid'}, color: {type: 'string'}},
          required: ['type', 'color'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            type: {const: 'linear-gradient'},
            colors: {type: 'array', minItems: 2, items: {type: 'string'}},
            stops: {type: 'array', items: {type: 'number', minimum: 0, maximum: 1}},
            angle: {type: 'number'},
          },
          required: ['type', 'colors'],
          additionalProperties: false,
        },
      ],
    },
    animation: {
      type: 'object',
      properties: {
        property: {enum: ['x', 'y', 'scale', 'rotation', 'opacity', 'blur']},
        from: {type: 'number'},
        to: {type: 'number'},
        startFrame: {type: 'integer', minimum: 0, default: 0},
        durationFrames: {type: 'integer', minimum: 1},
        easing: {
          enum: ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'back-out', 'elastic-out'],
          default: 'ease-in-out',
        },
      },
      required: ['property', 'from', 'to', 'durationFrames'],
      additionalProperties: false,
    },
    element: {
      type: 'object',
      properties: {
        id: {type: 'string'},
        type: {enum: ['text', 'shape', 'image']},
        x: {type: 'number'},
        y: {type: 'number'},
        width: {type: 'number', minimum: 0},
        height: {type: 'number', minimum: 0},
        zIndex: {type: 'integer'},
        startFrame: {type: 'integer', minimum: 0},
        endFrame: {type: 'integer', minimum: 0},
        opacity: {type: 'number'},
        scale: {type: 'number'},
        rotation: {type: 'number'},
        blur: {type: 'number'},
        blendMode: {type: 'string'},
        animations: {type: 'array', items: {$ref: '#/$defs/animation'}},
        text: {type: 'string'},
        fontSize: {type: 'number'},
        fontWeight: {type: ['number', 'string']},
        fontStyle: {type: 'string'},
        fontFamily: {type: 'string'},
        lineHeight: {type: 'number'},
        align: {enum: ['left', 'center', 'right']},
        uppercase: {type: 'boolean'},
        color: {type: 'string'},
        fill: {},
        cornerRadius: {type: 'number'},
        stroke: {
          type: 'object',
          properties: {color: {type: 'string'}, width: {type: 'number'}},
          required: ['color', 'width'],
          additionalProperties: false,
        },
        shadow: {
          type: 'object',
          properties: {
            color: {type: 'string'},
            blur: {type: 'number'},
            offsetX: {type: 'number'},
            offsetY: {type: 'number'},
          },
          additionalProperties: false,
        },
        src: {type: 'string'},
        fit: {enum: ['cover', 'contain']},
      },
      required: ['id', 'type', 'x', 'y'],
      additionalProperties: false,
    },
    scene: {
      type: 'object',
      properties: {
        id: {type: 'string'},
        startFrame: {type: 'integer', minimum: 0},
        durationFrames: {type: 'integer', minimum: 1},
        background: {$ref: '#/$defs/background'},
        elements: {type: 'array', items: {$ref: '#/$defs/element'}},
      },
      required: ['id', 'startFrame', 'durationFrames', 'elements'],
      additionalProperties: false,
    },
  };
}
