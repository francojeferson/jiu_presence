/// <reference lib="webworker" />

/**
 * Service worker.
 *
 * Pré-cacheia o shell para que o app abra sem rede (RF-06). As requisições
 * ao Supabase NÃO são cacheadas: os dados vêm do IndexedDB, que é
 * alimentado pelo sincronizador de cache. Cachear resposta de API aqui
 * criaria uma segunda fonte de verdade local, divergente da primeira.
 */

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // `?? []` em vez de repassar direto: o manifesto é injetado em tempo de
  // build e é `undefined` em desenvolvimento, o que `exactOptionalPropertyTypes`
  // corretamente recusa.
  precacheEntries: self.__SW_MANIFEST ?? [],
  // skipWaiting: false — uma versão NOVA espera a próxima abertura para
  // assumir. Trocar de versão no meio de uma chamada perderia o estado
  // parcial com a turma esperando (EC-02).
  skipWaiting: false,
  // clientsClaim: true — o service worker RECÉM-INSTALADO assume as abas
  // que ainda não têm controlador. Sem isso, a primeira visita fica
  // descontrolada e o app não abre offline, que é o requisito central
  // (RF-06). Não confundir com skipWaiting: aqui não há versão anterior
  // sendo substituída.
  clientsClaim: true,
  // navigationPreload desligado: só acelera o caminho online e, offline, a
  // promessa de preload rejeita e complica o caminho de fallback — que é
  // justamente o que precisa ser confiável aqui.
  navigationPreload: false,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
