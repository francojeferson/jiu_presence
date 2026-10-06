// Superfície pública da camada de aplicação.
//
// Orquestra casos de uso sobre as PORTAS declaradas no domínio. Não conhece
// Supabase, Dexie, React nem HTTP — a regra é verificada automaticamente.

export * from './chamada/casos-de-uso.js';
export * from './aluno/casos-de-uso.js';
