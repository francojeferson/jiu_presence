import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

/**
 * Toda rota com `page.tsx`, lida do disco.
 *
 * Derivada em vez de escrita à mão de propósito: uma lista manual envelhece
 * em silêncio, e a rota esquecida só se manifesta no tatame, sem rede, meses
 * depois. Segmentos dinâmicos (`[id]`) ficam de fora porque não existe
 * documento estático para pré-cachear.
 */
function rotasDoApp(diretorio = join(import.meta.dirname, 'src/app'), prefixo = ''): string[] {
  const rotas: string[] = [];
  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    if (entrada.name === 'page.tsx') rotas.push(prefixo === '' ? '/' : prefixo);
    if (!entrada.isDirectory() || entrada.name.startsWith('[')) continue;
    rotas.push(...rotasDoApp(join(diretorio, entrada.name), `${prefixo}/${entrada.name}`));
  }
  return rotas;
}

/**
 * PWA (RF-05, RF-06).
 *
 * O shell precisa renderizar offline em menos de 2 segundos. Sem service
 * worker com pré-cache, o professor abre o app no tatame sem rede e vê a
 * página de erro do navegador — e volta para a folha de papel.
 */
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  /**
   * As PÁGINAS, não só os scripts.
   *
   * O manifesto gerado traz apenas JS, CSS e ícones: nenhum documento HTML.
   * Sem estas entradas, abrir o app sem rede só funcionava para a página que
   * o professor por acaso já tinha carregado online — e nem a página
   * `/offline` podia ser servida, porque o próprio fallback não estava em
   * cache. O resultado era o erro de rede do navegador, que é o cenário do
   * risco R3.
   *
   * `revision: null` porque o nome do arquivo não carrega hash: o Serwist
   * revalida a entrada a cada build pelo conteúdo.
   */
  additionalPrecacheEntries: rotasDoApp().map((url) => ({ url, revision: null })),
  // EC-02: a nova versão baixa em segundo plano e ativa só na PRÓXIMA
  // abertura. Trocar de versão no meio de uma chamada perderia o estado
  // parcial com a turma esperando.
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@jiupresence/domain',
    '@jiupresence/application',
    '@jiupresence/infrastructure',
    '@jiupresence/contracts',
  ],
  typedRoutes: true,

  /**
   * Os pacotes do workspace importam com extensão `.js`, como exige
   * `verbatimModuleSyntax` no tsconfig. O webpack do Next transpila o TS
   * direto da fonte e não encontraria esses arquivos, porque `.js` não
   * existe em disco. O `extensionAlias` faz a ponte.
   */
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default withSerwist(nextConfig);
