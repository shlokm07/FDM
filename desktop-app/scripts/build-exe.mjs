import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const rootDir = path.resolve(process.cwd(), 'REA-IDM/desktop-app');
const distDir = path.join(rootDir, 'bin');
const buildTempDir = path.join(rootDir, '.build-temp');

fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(buildTempDir, { recursive: true });

console.log('[REA-IDM Build] 1. Building React + Tailwind Fluent UI and embedding static assets...');
execSync('npm run build:ui', { cwd: rootDir, stdio: 'inherit' });
const binUiDir = path.join(distDir, 'ui');
const indexHtml = fs.readFileSync(path.join(binUiDir, 'index.html'), 'utf-8');
const stylesCss = fs.readFileSync(path.join(binUiDir, 'styles.css'), 'utf-8');
const appJs = fs.readFileSync(path.join(binUiDir, 'app.js'), 'utf-8');

console.log('[REA-IDM Build] 2. Bundling TypeScript into single CommonJS file via esbuild...');
const bundleFile = path.join(buildTempDir, 'bundle.cjs');

await esbuild.build({
  entryPoints: [path.join(rootDir, 'src/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: bundleFile,
  sourcemap: false,
  minify: true,
  banner: {
    js: `
      // Inlined UI static assets for zero-dependency standalone execution
      globalThis.__EMBEDDED_INDEX_HTML = ${JSON.stringify(indexHtml)};
      globalThis.__EMBEDDED_STYLES_CSS = ${JSON.stringify(stylesCss)};
      globalThis.__EMBEDDED_APP_JS = ${JSON.stringify(appJs)};
    `,
  },
});

console.log('[REA-IDM Build] 3. Generating Node SEA preparation blob...');
const seaConfig = {
  main: bundleFile,
  output: path.join(buildTempDir, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
};

const seaConfigFile = path.join(buildTempDir, 'sea-config.json');
fs.writeFileSync(seaConfigFile, JSON.stringify(seaConfig, null, 2), 'utf-8');

execSync(`node --experimental-sea-config "${seaConfigFile}"`, { stdio: 'inherit' });

console.log('[REA-IDM Build] 4. Creating standalone executable rea-idm-core.exe...');
const targetExe = path.join(distDir, 'rea-idm-core.exe');

// Copy host Node binary as base executable
fs.copyFileSync(process.execPath, targetExe);

// Inject the SEA blob into the executable using postject
const blobPath = path.join(buildTempDir, 'sea-prep.blob');
const postjectCmd = `npx --yes postject "${targetExe}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;

console.log('[REA-IDM Build] 5. Injecting application code into executable...');
execSync(postjectCmd, { stdio: 'inherit' });

// Cleanup build temp
fs.rmSync(buildTempDir, { recursive: true, force: true });

console.log(`\n[REA-IDM Build] SUCCESS! Standalone executable created at:\n  ${targetExe}\n`);

