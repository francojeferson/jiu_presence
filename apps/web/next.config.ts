import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

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
