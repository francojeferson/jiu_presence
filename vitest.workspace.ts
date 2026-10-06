import { resolve } from 'node:path';
import { defineWorkspace } from 'vitest/config';

const raiz = import.meta.dirname;

/**
 * Aliases dos pacotes do workspace.
 *
 * Em produção a resolução vem do pnpm (`workspace:*`). Aqui eles são
 * explícitos para que a suíte rode mesmo sem links de workspace instalados.
 * Isto NÃO relaxa a regra de dependência: ela é verificada separadamente pelo
 * dependency-cruiser, que lê os imports, não o resolvedor de teste.
 */
const alias = {
  '@jiupresence/domain': resolve(raiz, 'packages/domain/src/index.ts'),
  '@jiupresence/contracts': resolve(raiz, 'packages/contracts/src/index.ts'),
  '@jiupresence/application': resolve(raiz, 'packages/application/src/index.ts'),
  '@jiupresence/infrastructure': resolve(
    raiz,
    'packages/infrastructure/src/index.ts',
  ),
};

export default defineWorkspace([
  {
    resolve: { alias },
    test: {
      name: 'domain',
      root: './packages/domain',
      environment: 'node',
      include: ['test/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/index.ts', 'src/portas/**'],
        // RNF-04: o domínio é puro, não há dificuldade de teste a alegar.
        thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
  {
    resolve: { alias },
    test: {
      name: 'application',
      root: './packages/application',
      environment: 'node',
      include: ['test/**/*.test.ts'],
    },
  },
  {
    resolve: { alias },
    test: {
      name: 'infrastructure',
      root: './packages/infrastructure',
      environment: 'node',
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  },
]);
