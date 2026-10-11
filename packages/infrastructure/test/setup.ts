// IndexedDB não existe em Node. `fake-indexeddb` instala uma implementação
// em memória, permitindo testar o outbox — que é o componente onde um erro
// custa uma presença confirmada pelo professor.
import 'fake-indexeddb/auto';

/**
 * Web Locks mínimo, também ausente em Node.
 *
 * Sem ele o sincronizador cairia no caminho "navegador sem Web Locks" e a
 * exclusão entre abas ficaria sem teste — justamente o que faz duas abas
 * pararem de enviar o mesmo item duas vezes.
 *
 * Só `ifAvailable` é implementado: é o único modo que o código usa, e uma
 * fila de espera completa seria maquinaria sem cliente.
 */
const tomados = new Set<string>();

Object.defineProperty(globalThis.navigator, 'locks', {
  configurable: true,
  value: {
    async request(
      nome: string,
      opcoes: { ifAvailable?: boolean },
      tarefa: (lock: { name: string } | null) => Promise<unknown>,
    ): Promise<unknown> {
      if (tomados.has(nome)) {
        if (opcoes.ifAvailable === true) return tarefa(null);
        throw new Error(`Modo não suportado neste stub: ${nome}`);
      }
      tomados.add(nome);
      try {
        return await tarefa({ name: nome });
      } finally {
        tomados.delete(nome);
      }
    },
  },
});
