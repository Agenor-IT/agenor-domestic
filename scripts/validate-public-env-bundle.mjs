import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const buildDir = path.resolve(process.argv[2] || 'dist');

if (!fs.existsSync(buildDir)) {
  throw new Error(`Build directory not found: ${buildDir}`);
}

const forbiddenPatterns = [
  '\uFEFFhttps://',
  '\uFEFFhttp://',
  '\uFEFFsb_',
  '\\uFEFFhttps://',
  '\\uFEFFhttp://',
  '\\uFEFFsb_',
];

const pending = [buildDir];
const javascriptFiles = [];

while (pending.length > 0) {
  const current = pending.pop();
  if (!current) continue;

  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      pending.push(absolutePath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      javascriptFiles.push(absolutePath);
    }
  }
}

if (javascriptFiles.length === 0) {
  throw new Error(`No JavaScript bundles found under ${buildDir}`);
}

for (const file of javascriptFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const matchedPattern = forbiddenPatterns.find(pattern => source.includes(pattern));
  if (matchedPattern) {
    throw new Error(`Public environment BOM leaked into ${path.relative(buildDir, file)} (${JSON.stringify(matchedPattern)})`);
  }
}

console.log(`Public environment bundle validation passed for ${javascriptFiles.length} JavaScript file(s).`);
