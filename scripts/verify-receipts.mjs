// Allows an isolated worktree to read compatible existing dependencies without installing or copying them.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dependencies = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || root);
const lockfile = path => readFileSync(resolve(path, 'package-lock.json'), 'utf8').replace(/\r\n/g, '\n');
if (lockfile(root) !== lockfile(dependencies)) {
  throw new Error('Dependency checkout must have exactly the same lockfile.');
}
const require = createRequire(resolve(dependencies, 'package.json'));
if (!process.argv.includes('--typecheck-only')) {
  const { startVitest } = await import(pathToFileURL(require.resolve('vitest/node')).href);
  const alias = Object.fromEntries(['react', 'react-dom', 'lucide-react', 'clsx', 'tailwind-merge']
    .map(name => [name, resolve(dependencies, 'node_modules', name)]));
  const instance = await startVitest('test', [
    'src/domain/receipts/ReceiptDraft.test.ts', 'src/application/receipts/receiptHandler.test.ts',
    'src/infrastructure/receipts/readReceipt.test.ts', 'src/presentation/components/ReceiptTransaction.test.tsx',
    'src/domain/consumption/Consumption.test.ts', 'src/domain/receipts/ReceiptProducts.test.ts',
    'src/infrastructure/SupabaseDomTransactionRepository.purchase.test.ts', 'src/infrastructure/SupabaseDomConsumptionRepository.test.ts'
  ], { root, config: false, run: true }, { resolve: { alias }, esbuild: { jsx: 'automatic' } });
  await instance?.close();
  if (process.exitCode) process.exit(process.exitCode);
}

const ts = require('typescript');
const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
parsed.options.typeRoots = [resolve(dependencies, 'node_modules/@types')];
const host = ts.createCompilerHost(parsed.options);
host.resolveModuleNames = (names, file) => names.map(name =>
  ts.resolveModuleName(name, file, parsed.options, ts.sys).resolvedModule ||
  ts.resolveModuleName(name, resolve(dependencies, 'src/resolution.ts'), parsed.options, ts.sys).resolvedModule);
const program = ts.createProgram([...parsed.fileNames, resolve(dependencies, 'node_modules/vite/client.d.ts')], parsed.options, host);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
for (const diagnostic of diagnostics) {
  console.error(`${diagnostic.file?.fileName || ''} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
}
console.log(`TypeScript: ${diagnostics.length} diagnostics`);
if (diagnostics.length) process.exitCode = 1;
