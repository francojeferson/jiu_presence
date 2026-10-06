// Superfície pública do pacote de domínio.
//
// TypeScript puro: zero dependências de runtime, zero framework, zero HTTP,
// zero browser. Compila e é testável em Node puro (RF-02), e a regra é
// verificada automaticamente por .dependency-cruiser.cjs (RF-03).

export * from './erros.js';

export * from './valor/identidade.js';
export * from './valor/data.js';
export * from './valor/faixa.js';

export * from './aluno/aluno.js';
export * from './turma/turma.js';
export * from './chamada/chamada.js';

export * from './portas/repositorios.js';
export * from './portas/reconhecimento-facial.js';
