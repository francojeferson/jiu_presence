/**
 * Normalização para busca (RF-34).
 *
 * Insensível a acento e a caixa. Sem isso, procurar por "joao" não acharia
 * "João" — e o professor de pé no tatame não vai digitar o acento.
 *
 * O intervalo ̀-ͯ é o bloco de marcas diacríticas combinantes, que
 * é o que a decomposição NFD separa das letras base.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
