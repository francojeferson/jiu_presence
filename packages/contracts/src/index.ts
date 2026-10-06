// Schemas Zod e os tipos derivados deles.
//
// Pacote FOLHA: não importa domain, application nem infrastructure. É o que
// permite que app e infraestrutura compartilhem a validação de fronteira sem
// que nenhum dos dois puxe o outro.

export * from './schemas.js';
