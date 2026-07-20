import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function createPlayerHtml(project) {
  const normalizedProject = structuredClone(project);
  for (const scene of normalizedProject.scenes) {
    for (const element of scene.elements) {
      if (element.type !== 'image' || !element.src) continue;
      if (path.isAbsolute(element.src)) element.src = pathToFileURL(element.src).href;
    }
  }
  const data = JSON.stringify(normalizedProject).replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="stage" width="${project.width}" height="${project.height}"></canvas>
  <script>
    const project = ${data};
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d', { alpha: false });
    const imageCache = new Map();

    const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

    function easing(name, t) {
      t = clamp(t);
      switch (name) {
        case 'ease-in': return t * t * t;
        case 'ease-out': return 1 - Math.pow(1 - t, 3);
        case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        case 'back-out': {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }
        case 'elastic-out': {
          const c4 = (2 * Math.PI) / 3;
          if (t === 0 || t === 1) return t;
          return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
        }
        default: return t;
      }
    }

    function animatedValue(element, property, localFrame, fallback) {
      let value = Number(element[property] ?? fallback);
      const animations = (element.animations || [])
        .filter((item) => item.property === property)
        .sort((a, b) => (a.startFrame || 0) - (b.startFrame || 0));
      for (const animation of animations) {
        const start = animation.startFrame || 0;
        const end = start + animation.durationFrames;
        if (localFrame < start) continue;
        if (localFrame >= end) {
          value = animation.to;
          continue;
        }
        const progress = easing(animation.easing || 'ease-in-out', (localFrame - start) / animation.durationFrames);
        value = animation.from + (animation.to - animation.from) * progress;
      }
      return value;
    }

    function canvasPaint(paint, box = {x: 0, y: 0, width: canvas.width, height: canvas.height}) {
      if (typeof paint === 'string') return paint;
      if (!paint || paint.type === 'solid') return paint?.color || '#000000';
      if (paint.type === 'linear-gradient') {
        const angle = ((paint.angle ?? 0) * Math.PI) / 180;
        const half = Math.abs(box.width * Math.cos(angle)) / 2 + Math.abs(box.height * Math.sin(angle)) / 2;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const gradient = ctx.createLinearGradient(
          cx - Math.cos(angle) * half,
          cy - Math.sin(angle) * half,
          cx + Math.cos(angle) * half,
          cy + Math.sin(angle) * half,
        );
        paint.colors.forEach((color, index) => {
          const stop = paint.stops?.[index] ?? index / Math.max(1, paint.colors.length - 1);
          gradient.addColorStop(clamp(stop), color);
        });
        return gradient;
      }
      return '#000000';
    }

    function drawBackground(background) {
      ctx.save();
      ctx.fillStyle = canvasPaint(background);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    function roundedRectPath(x, y, width, height, radius) {
      const r = Math.min(Math.max(0, radius || 0), Math.abs(width) / 2, Math.abs(height) / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }

    function applyCommonStyle(element) {
      ctx.globalCompositeOperation = element.blendMode || 'source-over';
      if (element.shadow) {
        ctx.shadowColor = element.shadow.color || 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = element.shadow.blur || 0;
        ctx.shadowOffsetX = element.shadow.offsetX || 0;
        ctx.shadowOffsetY = element.shadow.offsetY || 0;
      }
    }

    function drawShape(element) {
      const x = -(element.width || 100) / 2;
      const y = -(element.height || 100) / 2;
      const width = element.width || 100;
      const height = element.height || 100;
      roundedRectPath(x, y, width, height, element.cornerRadius || 0);
      ctx.fillStyle = canvasPaint(element.fill, {x, y, width, height});
      ctx.fill();
      if (element.stroke?.color && element.stroke?.width) {
        ctx.strokeStyle = element.stroke.color;
        ctx.lineWidth = element.stroke.width;
        ctx.stroke();
      }
    }

    function textLines(text, maxWidth) {
      const paragraphs = String(text).split('\\n');
      const lines = [];
      for (const paragraph of paragraphs) {
        const words = paragraph.split(/\\s+/).filter(Boolean);
        if (!words.length) {
          lines.push('');
          continue;
        }
        let line = words[0];
        for (const word of words.slice(1)) {
          const candidate = line + ' ' + word;
          if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
          else {
            lines.push(line);
            line = word;
          }
        }
        lines.push(line);
      }
      return lines;
    }

    function drawText(element) {
      const fontSize = element.fontSize || 72;
      const fontWeight = element.fontWeight || 700;
      const fontStyle = element.fontStyle || 'normal';
      const fontFamily = element.fontFamily || 'Arial, sans-serif';
      const width = element.width || canvas.width * 0.8;
      const lineHeight = fontSize * (element.lineHeight || 1.05);
      const align = element.align || 'left';
      const text = element.uppercase ? element.text.toUpperCase() : element.text;
      ctx.font = fontStyle + ' ' + fontWeight + ' ' + fontSize + 'px ' + fontFamily;
      ctx.textBaseline = 'top';
      ctx.textAlign = align;
      ctx.fillStyle = canvasPaint(element.fill || element.color || '#ffffff', {
        x: -width / 2,
        y: -(element.height || lineHeight) / 2,
        width,
        height: element.height || lineHeight,
      });
      const lines = textLines(text, width);
      const blockHeight = lines.length * lineHeight;
      const startY = -blockHeight / 2;
      const drawX = align === 'center' ? 0 : align === 'right' ? width / 2 : -width / 2;
      for (let index = 0; index < lines.length; index += 1) {
        const y = startY + index * lineHeight;
        if (element.stroke?.color && element.stroke?.width) {
          ctx.strokeStyle = element.stroke.color;
          ctx.lineWidth = element.stroke.width;
          ctx.strokeText(lines[index], drawX, y, width);
        }
        ctx.fillText(lines[index], drawX, y, width);
      }
    }

    function drawImage(element) {
      const image = imageCache.get(element.src);
      if (!image?.complete || !image.naturalWidth) return;
      const width = element.width || image.naturalWidth;
      const height = element.height || image.naturalHeight;
      const fit = element.fit || 'cover';
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = width / height;
      let sx = 0;
      let sy = 0;
      let sw = image.naturalWidth;
      let sh = image.naturalHeight;
      if (fit === 'cover') {
        if (sourceRatio > targetRatio) {
          sw = image.naturalHeight * targetRatio;
          sx = (image.naturalWidth - sw) / 2;
        } else {
          sh = image.naturalWidth / targetRatio;
          sy = (image.naturalHeight - sh) / 2;
        }
      }
      roundedRectPath(-width / 2, -height / 2, width, height, element.cornerRadius || 0);
      ctx.clip();
      if (fit === 'contain') {
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      } else {
        ctx.drawImage(image, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
      }
    }

    function drawElement(element, sceneFrame, sceneDuration) {
      const startFrame = element.startFrame || 0;
      const endFrame = element.endFrame ?? sceneDuration;
      if (sceneFrame < startFrame || sceneFrame >= endFrame) return;
      const localFrame = sceneFrame - startFrame;
      const x = animatedValue(element, 'x', localFrame, element.x ?? 0);
      const y = animatedValue(element, 'y', localFrame, element.y ?? 0);
      const scale = animatedValue(element, 'scale', localFrame, element.scale ?? 1);
      const rotation = animatedValue(element, 'rotation', localFrame, element.rotation ?? 0);
      const opacity = clamp(animatedValue(element, 'opacity', localFrame, element.opacity ?? 1));
      const blur = Math.max(0, animatedValue(element, 'blur', localFrame, element.blur ?? 0));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.globalAlpha = opacity;
      ctx.filter = blur ? 'blur(' + blur + 'px)' : 'none';
      applyCommonStyle(element);
      if (element.type === 'shape') drawShape(element);
      if (element.type === 'text') drawText(element);
      if (element.type === 'image') drawImage(element);
      ctx.restore();
    }

    async function preloadImages() {
      const sources = project.scenes.flatMap((scene) => scene.elements)
        .filter((element) => element.type === 'image')
        .map((element) => element.src);
      await Promise.all([...new Set(sources)].map((src) => new Promise((resolve) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = resolve;
        image.src = src;
        imageCache.set(src, image);
      })));
    }

    window.__NEXU_READY = preloadImages();
    window.__NEXU_RENDER_FRAME = async (frame) => {
      await window.__NEXU_READY;
      frame = Math.max(0, Math.min(project.durationFrames - 1, Math.round(frame)));
      drawBackground(project.background);
      const activeScenes = project.scenes
        .filter((scene) => frame >= scene.startFrame && frame < scene.startFrame + scene.durationFrames)
        .sort((a, b) => a.startFrame - b.startFrame);
      for (const scene of activeScenes) {
        if (scene.background) drawBackground(scene.background);
        const sceneFrame = frame - scene.startFrame;
        const elements = [...scene.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        for (const element of elements) drawElement(element, sceneFrame, scene.durationFrames);
      }
      return {frame};
    };
    window.__NEXU_RENDER_FRAME(0);
  </script>
</body>
</html>`;
}
