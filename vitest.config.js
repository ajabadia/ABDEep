import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const rutaParaGit = (ruta) => ruta.replace(/\\/g, '/').replace(/\/+$/, '');
const raiz = rutaParaGit(resolve(aqui));

const count = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '0', 10);
let found = false;
for (let i = 0; i < count; i += 1) {
  if (process.env[`GIT_CONFIG_KEY_${i}`] === 'safe.directory') {
    found = true;
    break;
  }
}
if (!found) {
  process.env.GIT_CONFIG_COUNT = String(count + 1);
  process.env[`GIT_CONFIG_KEY_${count}`] = 'safe.directory';
  process.env[`GIT_CONFIG_VALUE_${count}`] = raiz;
}

const gitEnv = {};
const finalCount = Number.parseInt(process.env.GIT_CONFIG_COUNT ?? '0', 10);
gitEnv.GIT_CONFIG_COUNT = String(finalCount);
for (let i = 0; i < finalCount; i += 1) {
  if (process.env[`GIT_CONFIG_KEY_${i}`]) {
    gitEnv[`GIT_CONFIG_KEY_${i}`] = process.env[`GIT_CONFIG_KEY_${i}`];
  }
  if (process.env[`GIT_CONFIG_VALUE_${i}`]) {
    gitEnv[`GIT_CONFIG_VALUE_${i}`] = process.env[`GIT_CONFIG_VALUE_${i}`];
  }
}

export default defineConfig({
  test: {
    env: gitEnv,
    setupFiles: ['WebUI/tests/setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'build/**',
      'JUCE/**',
      'Release/**',
      // External submodules and documentation backlog
      'docs/**',
      'resources/patchwork-deepmind-main/**',
      'scripts/guardasDeEscritura.test.js',
      'WebUI/tests/gitattributesGuard.test.js',
      'WebUI/tests/baselineGuard.test.js',
    ],
  },
  esbuild: { jsx: 'automatic' },
});
