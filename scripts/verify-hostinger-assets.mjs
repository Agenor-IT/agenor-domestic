import fs from 'node:fs';
import path from 'node:path';

const baseUrl = (process.env.DOMESTIC_BASE_URL || process.env.HOSTINGER_PRODUCTION_URL || '').replace(/\/$/, '');
const immutableDir = path.resolve(
  process.env.DOMESTIC_IMMUTABLE_DIR || 'tmp/atomic-deploy/immutable'
);
const propagationDelayMs = Number(process.env.DOMESTIC_ASSET_PROPAGATION_DELAY_MS || 15_000);
const retryDelayMs = Number(process.env.DOMESTIC_ASSET_RETRY_DELAY_MS || 3_000);
const maxAttempts = Number(process.env.DOMESTIC_ASSET_MAX_ATTEMPTS || 6);
const concurrency = Number(process.env.DOMESTIC_ASSET_CHECK_CONCURRENCY || 8);

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const walkFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });

const expectedContentType = (relativePath) => {
  if (relativePath.endsWith('.js')) return 'javascript';
  if (relativePath.endsWith('.css')) return 'text/css';
  return null;
};

const buildAssetUrl = (relativePath, attempt) => {
  const encodedPath = relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const url = new URL(encodedPath, `${baseUrl}/`);
  url.searchParams.set('deploy_asset_check', `${Date.now()}-${attempt}`);
  return url;
};

const verifyAsset = async (relativePath) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const url = buildAssetUrl(relativePath, attempt);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          'cache-control': 'no-cache',
          range: 'bytes=0-0',
        },
        signal: AbortSignal.timeout(15_000),
      });
      const contentType = response.headers.get('content-type') || '';
      await response.body?.cancel();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const expected = expectedContentType(relativePath);
      if (expected && !contentType.toLowerCase().includes(expected)) {
        throw new Error(`Content-Type ${contentType || 'vacio'}`);
      }

      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await sleep(retryDelayMs);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${relativePath}: ${message}`);
};

if (!baseUrl) {
  throw new Error('DOMESTIC_BASE_URL o HOSTINGER_PRODUCTION_URL es obligatorio para verificar los assets.');
}
if (!fs.existsSync(immutableDir)) {
  throw new Error(`No existe el directorio de assets inmutables ${immutableDir}.`);
}
if (!Number.isFinite(propagationDelayMs) || propagationDelayMs < 0) {
  throw new Error('DOMESTIC_ASSET_PROPAGATION_DELAY_MS debe ser un numero mayor o igual a cero.');
}
if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
  throw new Error('DOMESTIC_ASSET_MAX_ATTEMPTS debe ser un entero mayor o igual a uno.');
}
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error('DOMESTIC_ASSET_CHECK_CONCURRENCY debe ser un entero mayor o igual a uno.');
}

const relativePaths = walkFiles(immutableDir)
  .map((absolutePath) => path.relative(immutableDir, absolutePath).split(path.sep).join('/'))
  .sort();

if (relativePaths.length === 0) {
  throw new Error('No hay archivos inmutables para verificar.');
}

console.log(`Esperando ${propagationDelayMs}ms para propagacion de assets...`);
await sleep(propagationDelayMs);

console.log(`Verificando ${relativePaths.length} assets publicados en ${baseUrl}...`);

const queue = [...relativePaths];
const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
  while (queue.length > 0) {
    const nextPath = queue.shift();
    if (!nextPath) break;
    await verifyAsset(nextPath);
  }
});

await Promise.all(workers);

console.log(`Verificacion HTTP exitosa para todos los ${relativePaths.length} assets.`);
