const fs = require('fs');
const vm = require('vm');

function extractMappingFromScript(scriptSource) {
  const re = /function\s+getRecipeIdFromDishName[\s\S]*?const\s+mapping\s*=\s*\{([\s\S]*?)\};/m;
  const m = re.exec(scriptSource);
  if (!m) throw new Error('Failed to locate mapping object in assets/script.js');
  let body = m[1]
    .split('\n')
    .map((line) => line.replace(/\s*\/\/.*$/, ''))
    .join('\n');
  const code = `(function(){ return {${body}}; })()`;
  return vm.runInNewContext(code, {}, { timeout: 1000 });
}

function main() {
  const src = fs.readFileSync('assets/script.js', 'utf8');
  const mapping = extractMappingFromScript(src);
  const byId = new Map();
  for (const [name, id] of Object.entries(mapping)) {
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(name);
  }
  const duplicates = [];
  for (const [id, names] of byId.entries()) {
    if (names.length > 1) {
      duplicates.push({ id, names: names.sort() });
    }
  }
  // Sort by ID for stable output
  duplicates.sort((a, b) => a.id.localeCompare(b.id));
  console.log(JSON.stringify(duplicates, null, 2));
}

try {
  main();
} catch (e) {
  console.error('[list-duplicate-mappings] Error:', e.message);
  process.exit(1);
}


