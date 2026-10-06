import { describe, expect, it } from 'vitest';
import { Aluno } from '../src/aluno/aluno.js';
import { DataCivil } from '../src/valor/data.js';
import {
  CampoObrigatorio,
  ExclusaoBloqueadaPorHistorico,
  ValorInvalido,
} from '../src/erros.js';

const HOJE = DataCivil.deIso('2026-10-04');

function alunoAdulto(nome = 'Carlos Gracie') {
  return Aluno.criar({ nome, escala: 'adulta', faixa: 'azul' });
}

describe('Aluno', () => {
  describe('criação', () => {
    it('cria com os campos informados', () => {
      const aluno = Aluno.criar({
        nome: 'Helio Gracie',
        escala: 'adulta',
        faixa: 'preta',
        dataNascimento: DataCivil.deIso('1990-03-12'),
      });
      expect(aluno.nome).toBe('Helio Gracie');
      expect(aluno.faixa.nome).toBe('preta');
      expect(aluno.ativo).toBe(true);
    });

    it('nasce ativo', () => {
      expect(alunoAdulto().ativo).toBe(true);
    });

    it('recebe identificador automaticamente', () => {
      expect(alunoAdulto().id).toBeTruthy();
      expect(alunoAdulto().id).not.toBe(alunoAdulto().id);
    });

    it('remove espaços em volta do nome', () => {
      expect(alunoAdulto('  Rickson  ').nome).toBe('Rickson');
    });

    it('exige nome', () => {
      expect(() =>
        Aluno.criar({ nome: '', escala: 'adulta', faixa: 'branca' }),
      ).toThrow(CampoObrigatorio);
      expect(() =>
        Aluno.criar({ nome: '   ', escala: 'adulta', faixa: 'branca' }),
      ).toThrow(CampoObrigatorio);
    });

    it('exige faixa coerente com a escala', () => {
      expect(() =>
        Aluno.criar({ nome: 'Kid', escala: 'infantil', faixa: 'preta' }),
      ).toThrow(ValorInvalido);
    });

    it('aceita cadastro sem data de nascimento', () => {
      const aluno = Aluno.criar({
        nome: 'Sem data',
        escala: 'adulta',
        faixa: 'branca',
      });
      expect(aluno.dataNascimento).toBeNull();
      expect(aluno.idadeEm(HOJE)).toBeNull();
    });
  });

  describe('idade e escala', () => {
    it('calcula a idade a partir da data de nascimento', () => {
      const aluno = Aluno.criar({
        nome: 'Criança',
        escala: 'infantil',
        faixa: 'cinza',
        dataNascimento: DataCivil.deIso('2016-01-01'),
      });
      expect(aluno.idadeEm(HOJE)).toBe(10);
    });

    it('sinaliza quando a escala registrada diverge da idade', () => {
      // EC-01: a criança completou 16 anos mas segue na escala infantil.
      // O sistema SINALIZA; converter é decisão do professor.
      const aluno = Aluno.criar({
        nome: 'Cruzou o corte',
        escala: 'infantil',
        faixa: 'verde',
        dataNascimento: DataCivil.deIso('2010-01-01'),
      });
      expect(aluno.idadeEm(HOJE)).toBe(16);
      expect(aluno.escalaDivergeDaIdade(HOJE)).toBe(true);
      // E não converteu sozinho:
      expect(aluno.escala).toBe('infantil');
    });

    it('não sinaliza divergência quando a escala confere', () => {
      const aluno = Aluno.criar({
        nome: 'Adulto',
        escala: 'adulta',
        faixa: 'azul',
        dataNascimento: DataCivil.deIso('1995-01-01'),
      });
      expect(aluno.escalaDivergeDaIdade(HOJE)).toBe(false);
    });

    it('não sinaliza divergência sem data de nascimento', () => {
      expect(alunoAdulto().escalaDivergeDaIdade(HOJE)).toBe(false);
    });
  });

  describe('edição', () => {
    it('renomeia', () => {
      const aluno = alunoAdulto();
      aluno.renomear('Novo Nome');
      expect(aluno.nome).toBe('Novo Nome');
    });

    it('recusa renomear para vazio', () => {
      expect(() => alunoAdulto().renomear('  ')).toThrow(CampoObrigatorio);
    });

    it('atualiza o carimbo de modificação ao editar', () => {
      const aluno = alunoAdulto();
      const antes = aluno.dados().atualizadoEm;
      aluno.renomear('Outro', new Date(Date.parse(antes) + 60_000));
      expect(aluno.dados().atualizadoEm).not.toBe(antes);
    });

    it('altera a faixa validando contra a escala', () => {
      const aluno = alunoAdulto();
      aluno.alterarFaixa('adulta', 'roxa');
      expect(aluno.faixa.nome).toBe('roxa');
      expect(() => aluno.alterarFaixa('adulta', 'verde')).toThrow(ValorInvalido);
    });

    it('registrar graduação atualiza faixa e marco de contagem', () => {
      const aluno = alunoAdulto();
      aluno.registrarGraduacao('adulta', 'roxa', HOJE);
      expect(aluno.faixa.nome).toBe('roxa');
      expect(aluno.dataUltimaGraduacao?.iso).toBe(HOJE.iso);
    });
  });

  describe('ciclo de vida', () => {
    it('inativa e reativa', () => {
      const aluno = alunoAdulto();
      aluno.inativar();
      expect(aluno.ativo).toBe(false);
      aluno.reativar();
      expect(aluno.ativo).toBe(true);
    });

    it('inativar duas vezes é idempotente', () => {
      const aluno = alunoAdulto();
      aluno.inativar();
      const carimbo = aluno.dados().atualizadoEm;
      aluno.inativar();
      expect(aluno.dados().atualizadoEm).toBe(carimbo);
    });

    it('inativação preserva os demais dados', () => {
      const aluno = alunoAdulto('Preservado');
      aluno.inativar();
      expect(aluno.nome).toBe('Preservado');
      expect(aluno.faixa.nome).toBe('azul');
    });
  });

  describe('exclusão', () => {
    it('permite excluir aluno sem histórico', () => {
      expect(() => alunoAdulto().garantirQuePodeSerExcluido(0)).not.toThrow();
    });

    it('recusa excluir aluno com histórico', () => {
      // RF-15: o histórico de frequência é o ativo central do produto.
      expect(() => alunoAdulto().garantirQuePodeSerExcluido(1)).toThrow(
        ExclusaoBloqueadaPorHistorico,
      );
    });

    it('o erro oferece a inativação como alternativa', () => {
      try {
        alunoAdulto('Fulano').garantirQuePodeSerExcluido(5);
        expect.unreachable('deveria ter lançado');
      } catch (erro) {
        expect(erro).toBeInstanceOf(ExclusaoBloqueadaPorHistorico);
        const e = erro as ExclusaoBloqueadaPorHistorico;
        expect(e.alternativa).toBe('inativar');
        expect(e.message).toContain('Fulano');
        expect(e.message).toContain('inativação');
      }
    });
  });

  it('reconstitui a partir de dados persistidos', () => {
    const original = alunoAdulto('Reconstituído');
    const copia = Aluno.reconstituir(original.dados());
    expect(copia.nome).toBe(original.nome);
    expect(copia.id).toBe(original.id);
    expect(copia.faixa.igual(original.faixa)).toBe(true);
  });

  it('dados() devolve cópia, não a referência interna', () => {
    const aluno = alunoAdulto();
    const dados = aluno.dados();
    (dados as { nome: string }).nome = 'Adulterado';
    expect(aluno.nome).not.toBe('Adulterado');
  });
});
