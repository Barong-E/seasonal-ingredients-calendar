const fs = require('fs');

try {
  const s = fs.readFileSync('data/recipes.json', 'utf8');
  JSON.parse(s);
  console.log('OK');
} catch (e) {
  console.log('Parse error:', e.message);
  const m = /position (\d+)/.exec(e.message);
  if (m) {
    const pos = parseInt(m[1], 10);
    const s = fs.readFileSync('data/recipes.json', 'utf8');
    const start = Math.max(0, pos - 120);
    const end = Math.min(s.length, pos + 120);
    console.log('Near position', pos, 'snippet:\n', s.slice(start, end));
  }
  process.exit(1);
}


