'use strict'

const fs = require('node:fs');
const path = require('node:path');

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const root = path.join(__dirname, '..');
const from = path.join(root, 'dist-cjs');
const to = path.join(root, 'dist');

const files = [
  ['index.js', 'index.cjs'],
  ['overlay/loader.js', 'overlay/loader.cjs'],
];

for (const [srcRel, destRel] of files) {
  const src = path.join(from, srcRel);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(to, destRel);
  copy(src, dest);
}

