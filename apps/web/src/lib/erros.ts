/**
 * Tradução de erro para a interface.
 *
 * Nenhuma mensagem técnica chega ao professor. Ele não vai ler stack trace,
 * não vai entender código de erro e, se a tela parecer quebrada duas vezes
 * com a turma esperando, ele volta para a folha de papel (risco R3).
 *
 * Os erros de domínio já nascem em português e com a causa explicada, então
 * são repassados como estão. O resto vira uma frase genérica, mas acionável.
 */

import { ErroDeDominio } from '@jiupresence/domain';
import { ConfiguracaoAusente, ErroDeCotaEsgotada } from '@jiupresence/infrastructure';
import { DadosEmFormatoInesperado } from '@jiupresence/contracts';

export function mensagemDe(erro: unknown): string {
  if (erro instanceof ErroDeDominio) return erro.message;
  if (erro instanceof ErroDeCotaEsgotada) return erro.message;

  if (erro instanceof ConfiguracaoAusente) {
    return (
      'O aplicativo não está configurado corretamente. ' +
      'Avise quem instalou: falta uma variável de ambiente.'
    );
  }

  if (erro instanceof DadosEmFormatoInesperado) {
    return (
      'Os dados recebidos do servidor vieram em um formato que este ' +
      'aplicativo não reconhece. Pode ser que ele precise ser atualizado.'
    );
  }

  return 'Não foi possível concluir. Tente de novo em alguns instantes.';
}

/**
 * O erro oferece uma alternativa concreta?
 *
 * `ExclusaoBloqueadaPorHistorico` carrega `alternativa: 'inativar'` para que
 * a tela ofereça a inativação na MESMA tela em que recusa a exclusão, em vez
 * de deixar o professor sem saída.
 */
export function alternativaDe(erro: unknown): string | null {
  if (
    erro !== null &&
    typeof erro === 'object' &&
    'alternativa' in erro &&
    typeof erro.alternativa === 'string'
  ) {
    return erro.alternativa;
  }
  return null;
}
