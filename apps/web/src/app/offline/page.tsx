/**
 * Página servida pelo service worker quando uma navegação falha e não há
 * nada em cache — na prática, apenas na PRIMEIRA abertura sem rede (EC-01).
 *
 * O tom importa: estar offline é operação normal neste produto. A mensagem
 * explica que a configuração inicial é a única coisa que exige conexão, em
 * vez de apresentar o erro genérico do navegador.
 */
export default function Offline(): React.ReactElement {
  return (
    <main>
      <h1>Sem conexão</h1>
      <div className="cartao">
        <p>
          Esta é a primeira vez que o aplicativo abre neste aparelho, e a
          configuração inicial precisa de internet.
        </p>
        <p style={{ color: 'var(--texto-suave)', fontSize: '0.9rem' }}>
          Conecte uma vez em qualquer rede. Depois disso, a chamada funciona
          no tatame mesmo sem sinal.
        </p>
      </div>
    </main>
  );
}
