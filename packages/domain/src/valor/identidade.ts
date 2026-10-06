/**
 * Identidade das entidades: UUID v7 gerado no CLIENTE (D-07).
 *
 * Duas propriedades importam e só o v7 entrega as duas:
 *
 * 1. Gerada no cliente. Sem isso, uma entidade criada offline não pode ser
 *    referenciada por outra antes de chegar ao servidor — seria impossível
 *    cadastrar um aluno e registrar a presença dele na mesma sessão sem rede.
 *
 * 2. Ordenável por tempo. Os 48 bits iniciais são o timestamp em
 *    milissegundos, então a ordem lexicográfica dos ids coincide com a ordem
 *    de criação. Isso é aproveitado pelo outbox.
 *
 * A implementação é própria em vez de depender de uma biblioteca porque o
 * pacote `domain` não tem dependências de runtime por desenho (RF-02), e
 * gerar um v7 é pequeno o bastante para não justificar a exceção.
 *
 * @see RFC 9562, seção 5.7
 */

export type Id = string & { readonly __marca: 'Id' };

const HEX = '0123456789abcdef';

function bytesAleatorios(tamanho: number): Uint8Array {
  const buffer = new Uint8Array(tamanho);
  // `crypto` global existe em Node 18+ e em todo navegador alvo.
  globalThis.crypto.getRandomValues(buffer);
  return buffer;
}

function paraHex(bytes: Uint8Array): string {
  let saida = '';
  for (const byte of bytes) {
    saida += HEX[byte >> 4]! + HEX[byte & 0x0f]!;
  }
  return saida;
}

/**
 * Gera um UUID v7.
 *
 * @param agora milissegundos desde a época. Injetável para tornar os testes
 *              determinísticos, já que o domínio não deve ler o relógio
 *              diretamente dentro das entidades.
 */
export function novoId(agora: number = Date.now()): Id {
  const bytes = new Uint8Array(16);

  // 48 bits de timestamp, big-endian.
  bytes[0] = (agora / 2 ** 40) & 0xff;
  bytes[1] = (agora / 2 ** 32) & 0xff;
  bytes[2] = (agora / 2 ** 24) & 0xff;
  bytes[3] = (agora / 2 ** 16) & 0xff;
  bytes[4] = (agora / 2 ** 8) & 0xff;
  bytes[5] = agora & 0xff;

  const aleatorio = bytesAleatorios(10);
  bytes.set(aleatorio, 6);

  // Versão 7 nos 4 bits altos do byte 6.
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // Variante RFC 4122 nos 2 bits altos do byte 8.
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = paraHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-') as Id;
}

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ehId(valor: unknown): valor is Id {
  return typeof valor === 'string' && FORMATO_UUID.test(valor);
}

/** Converte uma string vinda de fora (banco, JSON) em `Id`, validando. */
export function comoId(valor: string): Id {
  if (!ehId(valor)) {
    throw new Error(`Identificador em formato inválido: "${valor}".`);
  }
  return valor;
}

/** Extrai o instante de criação embutido em um UUID v7. */
export function instanteDoId(id: Id): number {
  const hex = id.replace(/-/g, '').slice(0, 12);
  return Number.parseInt(hex, 16);
}
