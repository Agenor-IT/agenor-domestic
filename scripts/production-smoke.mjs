const baseUrl = (process.env.DOMESTIC_BASE_URL || process.env.HOSTINGER_PRODUCTION_URL || '').replace(/\/$/, '');
const expectedCommit = process.env.DOMESTIC_EXPECTED_COMMIT || process.env.DEPLOY_SHA || '';

if (!baseUrl) {
  throw new Error('DOMESTIC_BASE_URL o HOSTINGER_PRODUCTION_URL es obligatorio para el smoke productivo.');
}

const fetchOk = async (path, expectedContentType) => {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${baseUrl}${path}${separator}smoke=${Date.now()}`, {
    redirect: 'follow',
    headers: { 'cache-control': 'no-cache' },
  });

  if (!response.ok) {
    throw new Error(`${path} respondio HTTP ${response.status}.`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (expectedContentType && !contentType.includes(expectedContentType)) {
    throw new Error(`${path} devolvio Content-Type ${contentType || 'vacio'}.`);
  }

  return response;
};

const versionResponse = await fetchOk('/version.json', 'application/json');
const version = await versionResponse.json();
if (version.app !== 'agenor-domestic') {
  throw new Error(`version.json corresponde a ${version.app || 'una app desconocida'}.`);
}
if (expectedCommit && version.commit !== expectedCommit) {
  throw new Error(`Commit productivo ${version.commit} distinto de ${expectedCommit}.`);
}

const rootResponse = await fetchOk('/', 'text/html');
const rootHtml = await rootResponse.text();
if (!rootHtml.includes('id="root"')) {
  throw new Error('La pagina productiva no contiene el contenedor principal de React (id="root").');
}

const assetPaths = [...rootHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)]
  .map((match) => match[1]);
if (assetPaths.length === 0) {
  throw new Error('La pagina productiva no referencia assets JS/CSS versionados.');
}

for (const assetPath of new Set(assetPaths)) {
  const contentType = assetPath.endsWith('.js') ? 'javascript' : 'text/css';
  await fetchOk(assetPath, contentType);
}

const spaFallbackResponse = await fetchOk('/ingresos', 'text/html');
const spaFallbackHtml = await spaFallbackResponse.text();
if (!spaFallbackHtml.includes('id="root"')) {
  throw new Error('El fallback SPA de rutas no devolvio la aplicacion.');
}

console.log(`Smoke OK: ${baseUrl} (${assetPaths.length} assets, commit ${version.commit}).`);
