#!/usr/bin/env node
/**
 * Build the 3 standalone landing pages (sibling repo `portfolio-landing`) with
 * their production base paths, then copy each build into the Strapi `public/`
 * folder so they are served at:
 *   https://api.paulrichez.fr/nebula/   (Astro)
 *   https://api.paulrichez.fr/lumina/   (Next.js)
 *   https://api.paulrichez.fr/pulse/    (Vue 3 + Vite)
 *
 * Usage (from portfolio-2 root):  npm run sync:landings
 * Requires the `portfolio-landing` repo checked out next to `portfolio-2`.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const landingsRoot = resolve(__dirname, '../../portfolio-landing');
const publicDir = resolve(__dirname, '../portfolio-server/public');

const LANDINGS = [
  { name: 'nebula', dir: 'nebula-astro', out: 'dist' },
  { name: 'lumina', dir: 'lumina-next', out: 'out' },
  { name: 'pulse', dir: 'pulse-vue', out: 'dist' },
];

if (!existsSync(landingsRoot)) {
  console.error(`✖ portfolio-landing introuvable: ${landingsRoot}`);
  console.error('  Clone le repo à côté de portfolio-2 puis relance.');
  process.exit(1);
}

for (const { name, dir, out } of LANDINGS) {
  const projectDir = resolve(landingsRoot, dir);
  const outDir = resolve(projectDir, out);
  const dest = resolve(publicDir, name);

  console.log(`\n▶ ${name} — build (${dir})`);
  if (!existsSync(resolve(projectDir, 'node_modules'))) {
    execSync('npm install --no-audit --no-fund', { cwd: projectDir, stdio: 'inherit' });
  }
  execSync('npm run build', { cwd: projectDir, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

  console.log(`▶ ${name} — copie → public/${name}/`);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(outDir, dest, { recursive: true });
}

console.log('\n✓ Landings synchronisées dans portfolio-server/public/ (nebula, lumina, pulse).');
