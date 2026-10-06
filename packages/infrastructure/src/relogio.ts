import { DataCivil, type Relogio } from '@jiupresence/domain';

/**
 * Relógio do sistema.
 *
 * Implementação trivial. O valor da porta não está aqui, está em poder
 * injetar um relógio fixo nos testes: regra que lê `Date.now()` direto não é
 * testável de forma determinística.
 */
export class RelogioDoSistema implements Relogio {
  agora(): Date {
    return new Date();
  }
  hoje(): DataCivil {
    return DataCivil.hoje();
  }
}
