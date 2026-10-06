/**
 * Erros de domínio.
 *
 * Toda violação de invariante lança um erro desta hierarquia, nunca `Error`
 * cru. A camada de apresentação usa `mensagem` diretamente: já está em
 * português e já é compreensível pelo professor (RF-33).
 */

export abstract class ErroDeDominio extends Error {
  abstract readonly codigo: string;

  protected constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

export class CampoObrigatorio extends ErroDeDominio {
  readonly codigo = 'CAMPO_OBRIGATORIO';
  constructor(readonly campo: string) {
    super(`O campo "${campo}" é obrigatório.`);
  }
}

export class ValorInvalido extends ErroDeDominio {
  readonly codigo = 'VALOR_INVALIDO';
  constructor(mensagem: string) {
    super(mensagem);
  }
}

export class InvarianteViolada extends ErroDeDominio {
  readonly codigo = 'INVARIANTE_VIOLADA';
  constructor(mensagem: string) {
    super(mensagem);
  }
}

/**
 * RF-15: aluno com histórico de presença não pode ser excluído.
 * O erro carrega a alternativa, porque a interface precisa oferecê-la na
 * mesma tela em que recusa a exclusão.
 */
export class ExclusaoBloqueadaPorHistorico extends ErroDeDominio {
  readonly codigo = 'EXCLUSAO_BLOQUEADA_POR_HISTORICO';
  readonly alternativa = 'inativar';
  constructor(readonly entidade: string, readonly nome: string) {
    super(
      `${entidade} "${nome}" possui histórico registrado e não pode ser excluído. ` +
        `Use a inativação: o histórico é preservado e ele deixa de aparecer na chamada.`,
    );
  }
}
