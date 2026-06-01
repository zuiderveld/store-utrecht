/**
 * Vercel build: één api/router.js — verwijdert losse api/*.js na kopiëren naar server/lib/routes.
 */
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'api');
const serverLib = path.join(__dirname, '..', 'server', 'lib');

if (!fs.existsSync(serverLib)) {
  console.error('vercel-prep: server/lib ontbreekt');
  process.exit(1);
}

let removed = 0;
for (const name of fs.readdirSync(apiDir)) {
  if (name === 'router.js') continue;
  const full = path.join(apiDir, name);
  if (fs.statSync(full).isDirectory()) {
    fs.rmSync(full, { recursive: true, force: true });
    removed++;
    continue;
  }
  if (name.endsWith('.js') || name === 'package.json') {
    fs.unlinkSync(full);
    removed++;
  }
}

console.log('vercel-prep: alleen api/router.js actief.', removed ? `(${removed} verwijderd)` : '');
