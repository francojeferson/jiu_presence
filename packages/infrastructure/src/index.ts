// Superfície pública da camada de infraestrutura.
//
// Implementa as portas declaradas em @jiupresence/domain. Nenhum caso de uso
// importa daqui: a resolução acontece na composition root do app (RF-04).

export * from './local/db.js';
export * from './local/outbox.js';
export * from './local/cota.js';
export * from './local/repositorios.js';

export * from './sync/classificacao.js';
export * from './sync/conectividade.js';
export * from './sync/sincronizador.js';
export * from './sync/cache.js';

export * from './supabase/cliente.js';
export * from './supabase/operacoes.js';

export * from './mapeadores.js';
export * from './relogio.js';
export * from './log.js';
