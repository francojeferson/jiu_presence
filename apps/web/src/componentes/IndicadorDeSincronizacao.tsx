'use client';

/**
 * Indicador permanente de conectividade e pendências (RF-29).
 *
 * A linguagem é de INFORMAÇÃO, nunca de alarme. Estar offline no tatame é o
 * esperado; tratar isso como erro treinaria o professor a ignorar avisos —
 * exatamente o que não pode acontecer quando um aviso real aparecer.
 *
 * Só o estado de falha permanente pede atenção, porque é o único que exige
 * decisão dele.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { EstadoDeSincronizacao } from '@jiupresence/domain';
import { container } from '@/composicao/container';

export function IndicadorDeSincronizacao(): React.ReactElement | null {
  const [estado, setEstado] = useState<EstadoDeSincronizacao | null>(null);

  useEffect(() => {
    try {
      return container().sincronizador.observar(setEstado);
    } catch {
      // Configuração ausente: a tela de erro já cobre o caso.
      return undefined;
    }
  }, []);

  if (estado === null) return null;

  const { online, pendentes, falhasPermanentes, sincronizando } = estado;

  if (falhasPermanentes > 0) {
    return (
      <Link href="/pendencias" className="indicador atencao">
        {falhasPermanentes === 1
          ? '1 registro precisa da sua atenção'
          : `${falhasPermanentes} registros precisam da sua atenção`}
      </Link>
    );
  }

  if (sincronizando) {
    return <div className="indicador">Enviando…</div>;
  }

  if (pendentes > 0) {
    return (
      <div className="indicador">
        {pendentes === 1 ? '1 registro aguardando envio' : `${pendentes} registros aguardando envio`}
        {!online && ' · sem conexão'}
      </div>
    );
  }

  if (!online) {
    return <div className="indicador">Sem conexão · tudo salvo no aparelho</div>;
  }

  return null;
}
