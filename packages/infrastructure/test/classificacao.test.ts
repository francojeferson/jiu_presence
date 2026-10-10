import { describe, expect, it } from 'vitest';
import {
  classificar,
  mensagemParaOProfessor,
  type RespostaDoServidor,
} from '../src/sync/classificacao.js';

const ok = (status: number): RespostaDoServidor => ({ status });
const conflito = (constraint: string): RespostaDoServidor => ({
  status: 409,
  codigo: '23505',
  constraint,
});

describe('classificação da resposta do servidor', () => {
  describe('sucesso', () => {
    it('classifica 2xx como sucesso', () => {
      expect(classificar(ok(200), 'criar_chamada')).toBe('sucesso');
      expect(classificar(ok(201), 'criar_chamada')).toBe('sucesso');
      expect(classificar(ok(204), 'remover_presenca')).toBe('sucesso');
    });
  });

  describe('o 409 e sua assimetria', () => {
    it('conflito na CHAVE PRIMÁRIA é sucesso idempotente', () => {
      // "Você já me mandou isso." O item foi gravado em tentativa anterior
      // cuja confirmação se perdeu na rede.
      expect(classificar(conflito('chamada_pkey'), 'criar_chamada')).toBe('sucesso');
      expect(classificar(conflito('presenca_pkey'), 'criar_presenca')).toBe('sucesso');
      expect(classificar(conflito('aluno_pkey'), 'criar_aluno')).toBe('sucesso');
    });

    it('conflito de presença duplicada é sucesso', () => {
      // A intenção era "este aluno esteve presente nesta chamada", e isso já
      // é verdade. Não há informação a perder.
      expect(
        classificar(conflito('presenca_unica_por_chamada_e_aluno'), 'criar_presenca'),
      ).toBe('sucesso');
    });

    it('conflito de chamada duplicada é falha PERMANENTE', () => {
      // Diferente do caso acima: outra chamada ocupa aquele turma+data, e
      // isso exige decisão do professor (EC-10).
      expect(
        classificar(conflito('chamada_unica_por_turma_e_data'), 'criar_chamada'),
      ).toBe('permanente');
    });

    it('conflito em constraint desconhecida é permanente', () => {
      // Retentar em laço não resolveria e esconderia o problema.
      expect(classificar(conflito('alguma_outra'), 'criar_aluno')).toBe('permanente');
    });
  });

  describe('transitórios', () => {
    it('sessão expirada é transitório, nunca descarte', () => {
      // EC-12: manter a fila intacta e renovar a sessão. Perder pendência
      // por falta de sessão seria perder o trabalho do professor.
      expect(classificar(ok(401), 'criar_chamada')).toBe('transitorio');
    });

    it('indisponibilidade do servidor é transitória', () => {
      for (const status of [500, 502, 503, 504]) {
        expect(classificar(ok(status), 'criar_chamada')).toBe('transitorio');
      }
    });

    it('timeout e excesso de requisições são transitórios', () => {
      expect(classificar(ok(408), 'criar_presenca')).toBe('transitorio');
      expect(classificar(ok(429), 'criar_presenca')).toBe('transitorio');
    });

    it('violação de chave estrangeira é transitória', () => {
      // EC-03: a entidade referenciada ainda não subiu. A ordenação da fila
      // deveria prevenir; se ocorrer, retentar após o item anterior.
      expect(
        classificar({ status: 409, codigo: '23503' }, 'criar_presenca'),
      ).toBe('transitorio');
    });

    it('histórico no servidor impede exclusão sem envenenar a fila', () => {
      const resposta = { status: 409, codigo: '23503' };
      expect(classificar(resposta, 'excluir_aluno')).toBe('permanente');
      expect(classificar(resposta, 'excluir_turma')).toBe('permanente');
      expect(mensagemParaOProfessor(resposta, 'excluir_aluno')).toContain(
        'Inative-o',
      );
      expect(mensagemParaOProfessor(resposta, 'excluir_turma')).toContain(
        'Desative-a',
      );
    });

    it('status desconhecido é transitório por desenho', () => {
      // Errar para o lado de retentar preserva o dado;
      // errar para o lado de descartar o perde.
      expect(classificar(ok(418), 'criar_chamada')).toBe('transitorio');
      expect(classificar(ok(0), 'criar_chamada')).toBe('transitorio');
    });
  });

  describe('permanentes', () => {
    it('entidade removida no servidor exige decisão', () => {
      expect(classificar(ok(404), 'atualizar_aluno')).toBe('permanente');
    });

    it('remover algo que já não existe é sucesso', () => {
      // O estado desejado já é o atual.
      expect(classificar(ok(404), 'remover_presenca')).toBe('sucesso');
      expect(classificar(ok(404), 'excluir_aluno')).toBe('sucesso');
      expect(classificar(ok(404), 'excluir_turma')).toBe('sucesso');
    });

    it('dado inválido nunca é retentado em laço', () => {
      expect(classificar(ok(400), 'criar_aluno')).toBe('permanente');
      expect(classificar(ok(422), 'criar_aluno')).toBe('permanente');
    });
  });

  describe('mensagem para o professor', () => {
    it('explica uma pendência local corrompida sem expor detalhes técnicos', () => {
      const msg = mensagemParaOProfessor(
        { status: 422, codigo: 'PAYLOAD_INVALIDO' },
        'criar_aluno',
      );
      expect(msg).toMatch(/pendência.*corrompida/i);
      expect(msg).not.toContain('PAYLOAD_INVALIDO');
    });

    it('traduz o conflito de chamada duplicada', () => {
      const msg = mensagemParaOProfessor(
        conflito('chamada_unica_por_turma_e_data'),
        'criar_chamada',
      );
      expect(msg).toBe('Já existe uma chamada registrada para esta turma neste dia.');
    });

    it('explica o registro removido no servidor', () => {
      expect(mensagemParaOProfessor(ok(404), 'atualizar_aluno')).toMatch(
        /não existe mais no servidor/,
      );
    });

    it('nunca expõe código técnico', () => {
      const mensagens = [
        mensagemParaOProfessor(ok(400), 'criar_aluno'),
        mensagemParaOProfessor(ok(500), 'criar_chamada'),
        mensagemParaOProfessor(conflito('x'), 'criar_presenca'),
      ];
      for (const msg of mensagens) {
        expect(msg).not.toMatch(/\b(409|500|400|23505|constraint|pkey)\b/);
      }
    });

    it('nomeia a operação em português', () => {
      expect(mensagemParaOProfessor(ok(500), 'criar_chamada')).toContain('chamada');
      expect(mensagemParaOProfessor(ok(500), 'criar_presenca')).toContain('presença');
      expect(mensagemParaOProfessor(ok(500), 'criar_matricula')).toContain('matrícula');
    });
  });
});
