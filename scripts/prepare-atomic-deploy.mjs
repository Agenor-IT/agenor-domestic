import fs from 'node:fs';
import path from 'node:path';

const buildDir = path.resolve(process.env.DOMESTIC_BUILD_DIR || process.env.BUILD_DIR || 'dist');
const stagingDir = path.resolve(process.env.DOMESTIC_DEPLOY_STAGING_DIR || process.env.DEPLOY_STAGING_DIR || 'tmp/atomic-deploy');
const immutableDir = path.join(stagingDir, 'immutable');
const shellDir = path.join(stagingDir, 'shell');
const serviceWorkerDir = path.join(stagingDir, 'service-worker');
const indexDir = path.join(stagingDir, 'index');
const versionDir = path.join(stagingDir, 'version');

const STAGED_ROOT_FILES = new Map([
  ['.htaccess', shellDir],
  ['manifest.webmanifest', shellDir],
  ['favicon.svg', shellDir],
  ['apple-touch-icon.png', shellDir],
  ['sw.js', serviceWorkerDir],
  ['registerSW.js', serviceWorkerDir],
  ['index.html', indexDir],
  ['version.json', versionDir],
]);

const REQUIRED_SHELL_FILES = [
  '.htaccess',
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'version.json',
];

const walkFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });

if (!fs.existsSync(buildDir)) {
  throw new Error(`No existe el build en ${buildDir}.`);
}

for (const requiredFile of REQUIRED_SHELL_FILES) {
  if (!fs.existsSync(path.join(buildDir, requiredFile))) {
    throw new Error(`El build no contiene ${requiredFile}; no es seguro preparar el deploy.`);
  }
}

fs.rmSync(stagingDir, { recursive: true, force: true });
for (const directory of [immutableDir, shellDir, serviceWorkerDir, indexDir, versionDir]) {
  fs.mkdirSync(directory, { recursive: true });
}

const manifest = {
  immutable: [],
  shell: [],
  serviceWorker: [],
  index: [],
  version: [],
};

for (const sourcePath of walkFiles(buildDir)) {
  const relativePath = path.relative(buildDir, sourcePath);
  const normalizedPath = relativePath.split(path.sep).join('/');
  
  // Si empieza con workbox-, enviarlo a serviceWorkerDir
  let controlledDestination;
  if (!normalizedPath.includes('/')) {
    if (normalizedPath.startsWith('workbox-')) {
      controlledDestination = serviceWorkerDir;
    } else {
      controlledDestination = STAGED_ROOT_FILES.get(normalizedPath);
    }
  }

  const destinationRoot = controlledDestination || immutableDir;
  const destinationPath = path.join(destinationRoot, relativePath);

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  if (destinationRoot === shellDir) manifest.shell.push(normalizedPath);
  else if (destinationRoot === serviceWorkerDir) manifest.serviceWorker.push(normalizedPath);
  else if (destinationRoot === indexDir) manifest.index.push(normalizedPath);
  else if (destinationRoot === versionDir) manifest.version.push(normalizedPath);
  else manifest.immutable.push(normalizedPath);
}

if (manifest.immutable.length === 0) {
  throw new Error('El deploy atomico no encontro archivos inmutables para publicar antes del shell.');
}

if (!manifest.serviceWorker.includes('sw.js')) {
  throw new Error('La etapa serviceWorker no contiene sw.js.');
}

if (manifest.index.length !== 1 || manifest.index[0] !== 'index.html') {
  throw new Error('La etapa index no contiene exclusivamente index.html.');
}

if (manifest.version.length !== 1 || manifest.version[0] !== 'version.json') {
  throw new Error('La etapa version no contiene exclusivamente version.json.');
}

fs.writeFileSync(
  path.join(stagingDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(
  `Deploy atomico preparado: ${manifest.immutable.length} inmutables, ${manifest.shell.length} shell, ${manifest.serviceWorker.length} service worker, index y version separados.`
);
