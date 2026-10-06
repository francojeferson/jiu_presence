/**
 * Composition root (RF-04).
 *
 * O ÚNICO lugar do sistema onde portas viram adaptadores concretos. Nenhum
 * caso de uso e nenhuma tela instancia `SupabaseClient` ou `BancoLocal`
 * diretamente.
 *
 * É a correção direta do que travou as duas tentativas anteriores: em
 * `registration_screen.dart`, `SupabaseService()` era instanciado dentro da
 * tela, o que tornou os testes impossíveis sem o método público
 * `setTestState` criado só para contornar.
 */

'use client';

import {
  CasosDeUsoDaChamada,
  CasosDeUsoDeAluno,
  CasosDeUsoDeTurma,
} from '@jiupresence/application';
import {
  MonitorDeConectividade,
  OperacoesRemotas,
  RelogioDoSistema,
  RepositoriosLocais,
  SincronizadorDeCache,
  SincronizadorOutbox,
  SondaHttp,
  bancoLocal,
  criarCliente,
  lerConfiguracao,
  portasLocais,
  solicitarArmazenamentoPersistente,
  type SupabaseClient,
} from '@jiupresence/infrastructure';

export interface Container {
  readonly supabase: SupabaseClient;
  readonly chamada: CasosDeUsoDaChamada;
  readonly aluno: CasosDeUsoDeAluno;
  readonly turma: CasosDeUsoDeTurma;
  readonly sincronizador: SincronizadorOutbox;
  readonly cache: SincronizadorDeCache;
  readonly conectividade: MonitorDeConectividade;
}

let instancia: Container | null = null;

export function container(): Container {
  if (instancia !== null) return instancia;

  const config = lerConfiguracao({
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  });

  const supabase = criarCliente(config);
  const db = bancoLocal();
  const relogio = new RelogioDoSistema();

  // Repositórios LOCAIS: a leitura vem do cache e a escrita vai para o
  // outbox. O Supabase nunca é consultado no caminho crítico da chamada —
  // é isso que faz o fluxo funcionar offline.
  const repos = new RepositoriosLocais(db);
  const portas = portasLocais(repos);

  const conectividade = new MonitorDeConectividade(
    new SondaHttp(config.url, config.chaveAnonima),
  );

  const sincronizador = new SincronizadorOutbox(
    new OperacoesRemotas(supabase),
    conectividade,
    db,
  );

  instancia = {
    supabase,
    chamada: new CasosDeUsoDaChamada({
      chamadas: portas.chamadas,
      turmas: portas.turmas,
      alunos: portas.alunos,
      relogio,
    }),
    aluno: new CasosDeUsoDeAluno({
      alunos: portas.alunos,
      turmas: portas.turmas,
      matriculas: portas.matriculas,
      relogio,
    }),
    turma: new CasosDeUsoDeTurma({
      alunos: portas.alunos,
      turmas: portas.turmas,
      matriculas: portas.matriculas,
      relogio,
    }),
    sincronizador,
    cache: new SincronizadorDeCache(supabase, db),
    conectividade,
  };

  return instancia;
}

/**
 * Inicialização única, disparada pelo shell.
 *
 * A ordem importa: destravar e começar a sincronizar ANTES de puxar o cache.
 * Se a rede estiver instável, o que já foi registrado pelo professor sobe
 * primeiro; atualizar o cache é secundário.
 */
export async function iniciar(): Promise<void> {
  const c = container();

  // Reduz a chance de o navegador despejar o armazenamento sob pressão de
  // espaço, o que levaria junto a fila de presenças pendentes.
  await solicitarArmazenamentoPersistente();

  await c.sincronizador.iniciar();

  try {
    await c.cache.reconstruirSeDefasado();
    if (c.conectividade.online) await c.cache.puxar();
  } catch {
    // Falhar ao atualizar o cache é aceitável: o cache anterior continua
    // servindo e a chamada funciona. Não é motivo para quebrar a abertura
    // do app no tatame.
  }
}

/** Apenas para teste: descarta o container memoizado. */
export function redefinirContainer(): void {
  instancia = null;
}
