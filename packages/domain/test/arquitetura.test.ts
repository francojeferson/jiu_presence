/**
 * Teste da regra de dependência (RF-03, D-04).
 *
 * Roda o dependency-cruiser como TESTE, não apenas em CI, para que a violação
 * falhe localmente antes do push.
 *
 * Usa a API Node em vez de subprocesso: invocar `npx.cmd` via execFileSync
 * falha com EINVAL no Windows, e o teste que protege a arquitetura não pode
 * depender do sistema operacional de quem roda.
 *
 * ⚠️ VERIFICAÇÃO NEGATIVA OBRIGATÓRIA (onboarding.md §4):
 * adicione `import '@jiupresence/infrastructure'` em qualquer arquivo de
 * packages/domain/src e confirme que este teste FALHA. Se ele passar, a
 * verificação não está ativa e o problema estrutural das duas tentativas
 * anteriores em Flutter foi reintroduzido sem ninguém perceber.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(import.meta.dirname, '../../..');
const CAMINHO_CONFIG = resolve(RAIZ, '.dependency-cruiser.cjs');

const require = createRequire(import.meta.url);

interface Violacao {
  readonly rule: { readonly name: string; readonly severity: string };
  readonly from: string;
  readonly to: string;
}

interface ConfigDoCruiser {
  readonly forbidden: readonly { readonly name: string }[];
  readonly options: Record<string, unknown>;
}

function lerConfig(): ConfigDoCruiser {
  return require(CAMINHO_CONFIG) as ConfigDoCruiser;
}

async function analisar(): Promise<readonly Violacao[]> {
  const { cruise } = await import('dependency-cruiser');
  const config = lerConfig();

  // O cruiser resolve caminhos relativos ao cwd.
  const cwdOriginal = process.cwd();
  process.chdir(RAIZ);
  try {
    const resultado = await cruise(['packages', 'apps'], {
      ...config.options,
      ruleSet: { forbidden: config.forbidden },
      validate: true,
    } as Parameters<typeof cruise>[1]);

    const saida = resultado.output;
    if (typeof saida === 'string') {
      throw new Error('dependency-cruiser devolveu texto em vez de objeto.');
    }
    return saida.summary.violations as readonly Violacao[];
  } finally {
    process.chdir(cwdOriginal);
  }
}

describe('regra de dependência da Arquitetura Limpa', () => {
  it('a configuração do verificador existe', () => {
    // Sem isso, os testes abaixo passariam vazios, dando a falsa impressão
    // de que a fronteira está protegida.
    expect(existsSync(CAMINHO_CONFIG)).toBe(true);
  });

  it('declara as regras que protegem cada camada', () => {
    const nomes = lerConfig().forbidden.map((r) => r.name);

    expect(nomes).toContain('domain-nao-depende-de-ninguem');
    expect(nomes).toContain('application-nao-depende-de-infra-nem-ui');
    expect(nomes).toContain('contracts-e-folha');
    expect(nomes).toContain('infra-nao-depende-de-ui');
    expect(nomes).toContain('sem-dependencia-circular');
    expect(nomes).toContain('nao-tocar-no-legado-flutter');
  });

  it('nenhuma camada importa de camada mais externa', async () => {
    const violacoes = await analisar();
    const erros = violacoes.filter((v) => v.rule.severity === 'error');

    const descricao = erros
      .map((v) => `  [${v.rule.name}] ${v.from} -> ${v.to}`)
      .join('\n');

    expect(
      erros.length,
      erros.length === 0
        ? ''
        : `Violações da regra de dependência:\n${descricao}\n\n` +
            'Se uma camada interna precisa de algo da externa, a dependência ' +
            'está invertida: declare uma porta no domínio e implemente o ' +
            'adaptador na infraestrutura.',
    ).toBe(0);
  }, 60_000);

  it('o pacote de domínio não declara dependência de runtime', () => {
    // RF-02 verificado também pelo manifesto, não só pelos imports: uma
    // dependência declarada mas ainda não usada é a próxima violação
    // esperando para acontecer.
    const manifesto = JSON.parse(
      readFileSync(resolve(RAIZ, 'packages/domain/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(Object.keys(manifesto.dependencies ?? {})).toEqual([]);
  });
});
