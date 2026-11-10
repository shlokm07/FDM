import fs from 'node:fs';
import path from 'node:path';

// Generate a valid uncompressed RGBA PNG
function createPng(width, height, r, g, b) {
  // Simple BMP to PNG or minimal valid 1x1 base64 expanded
  // Minimal valid 1x1 green/cyan PNG
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVHhe7c4BDQAACMMg+zdcZwgHNyC5bZpOmqZpmqZpmqZpmqZpmqZpmqZpmqZpmqZpmqZpmqZpmqY5q/sBo4a6pFsAAAAASUVORK5CYII=';
  return Buffer.from(base64Png, 'base64');
}

const iconsDir = path.resolve(process.cwd(), 'REA-IDM/chrome-extension/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const png = createPng(48, 48, 14, 165, 233);
fs.writeFileSync(path.join(iconsDir, 'icon16.png'), png);
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), png);
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), png);
console.log('Extension icons created.');

