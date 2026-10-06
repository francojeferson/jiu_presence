/**
 * Banco local (IndexedDB via Dexie) — cache de leitura e outbox de escrita.
 *
 * Duas tabelas com naturezas opostas, e a assimetria é deliberada:
 *
 *   `cache`  é DESCARTÁVEL. Reconstrói-se a partir do servidor a qualquer
 *            momento. Em recuperação de inconsistência, pode ser apagado.
 *
 *   `outbox` é a ÚNICA cópia de uma intenção do professor. Nunca é descartado,
 *            nem por cota cheia, nem por logout, nem por cache corrompido.
 *            Perder uma presença confirmada é a falha mais grave possível
 *            deste sistema (RNF-01 de sincronizacao-offline-first).
 */

import Dexie, { type EntityTable } from 'dexie';

export type TipoDeOperacao =
  | 'criar_aluno'
  | 'atualizar_aluno'
  | 'inativar_aluno'
  | 'criar_turma'
  | 'atualizar_turma'
  | 'criar_matricula'
  | 'encerrar_matricula'
  | 'criar_chamada'
  | 'confirmar_chamada'
  | 'criar_presenca'
  | 'remover_presenca';

export type EstadoDoItem = 'pendente' | 'enviando' | 'falha_permanente';

export interface ItemDaFila {
  /** UUID v7. É também a chave de idempotência enviada ao servidor (D-08). */
  id: string;
  tipo: TipoDeOperacao;
  payload: unknown;
  /** Data real do evento, nunca a do envio (RF-31). */
  criadoEm: string;
  /**
   * Sequencial monotônico local. A ordenação usa ESTE campo, não o relógio:
   * o relógio do dispositivo pode ser alterado manualmente ou corrigido por
   * NTP, e isso embaralharia a fila (EC-06).
   */
  ordem: number;
  tentativas: number;
  proximaTentativaEm: string | null;
  estado: EstadoDoItem;
  erro: string | null;
}

export interface EntradaDeCache {
  chave: string;
  valor: unknown;
  atualizadoEm: string;
  versaoSchema: number;
}

/**
 * Contadores persistentes.
 *
 * Existe por causa de um bug concreto: derivar o próximo sequencial do maior
 * `ordem` ainda presente no outbox faz o contador REINICIAR assim que a fila
 * esvazia. Um item criado depois receberia ordem menor que a de um pendente
 * remanescente, quebrando a garantia de ordenação de que a sincronização
 * depende (RF-25).
 */
export interface Contador {
  nome: string;
  valor: number;
}

export const CONTADOR_DE_ORDEM = 'outbox.ordem';

/** Incrementar força reconstrução do cache, preservando a fila (RF-17). */
export const VERSAO_DO_SCHEMA_LOCAL = 1;

export class BancoLocal extends Dexie {
  declare outbox: EntityTable<ItemDaFila, 'id'>;
  declare cache: EntityTable<EntradaDeCache, 'chave'>;
  declare contadores: EntityTable<Contador, 'nome'>;

  constructor(nome = 'jiupresence') {
    super(nome);
    this.version(1).stores({
      outbox: 'id, ordem, estado, proximaTentativaEm',
      cache: 'chave, versaoSchema',
      contadores: 'nome',
    });
  }

  /**
   * Incrementa e devolve o contador, em transação, para que duas escritas
   * simultâneas não recebam o mesmo valor.
   */
  async proximoValorDe(nome: string): Promise<number> {
    return this.transaction('rw', this.contadores, async () => {
      const atual = await this.contadores.get(nome);
      const proximo = (atual?.valor ?? 0) + 1;
      await this.contadores.put({ nome, valor: proximo });
      return proximo;
    });
  }
}

let instancia: BancoLocal | null = null;

export function bancoLocal(): BancoLocal {
  instancia ??= new BancoLocal();
  return instancia;
}

/** Apenas para testes: substitui a instância compartilhada. */
export function definirBancoLocal(banco: BancoLocal | null): void {
  instancia = banco;
}
