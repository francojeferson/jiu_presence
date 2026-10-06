// DESCARTAVEL — sonda da Fase 0. Nao e codigo de produto.
// Roda YuNet e SCRFD sobre o conjunto de avaliacao e mede taxa de deteccao
// e distribuicao de tamanho de rosto. Saida em .avaliacao/saida/ (fora do git).
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  criarYunet,
  criarScrfd,
  estrategiaInteira,
  estrategiaLadrilho,
  lerImagem,
} from './detectores.mjs';

const FOTOS = path.resolve('../../.avaliacao/fotos');
const SAIDA = path.resolve('../../.avaliacao/saida');
const LIMIAR_COLETA = 0.2; // coleta baixo; o corte por confianca e feito na analise
const CORTES = [0.3, 0.5, 0.7, 0.9];

const CORES = { yunet: '#00e5ff', scrfd: '#ff3d71' };

async function anotar(caminhoFoto, caixas, destino, cor) {
  const { largura, altura } = await lerImagem(caminhoFoto);
  const traco = Math.max(2, Math.round(Math.max(largura, altura) / 600));
  const fonte = Math.max(12, Math.round(Math.max(largura, altura) / 70));
  const formas = caixas
    .map((b, i) => {
      const x = Math.round(b.x);
      const y = Math.round(b.y);
      const l = Math.round(b.l);
      const a = Math.round(b.a);
      return (
        `<rect x="${x}" y="${y}" width="${l}" height="${a}" fill="none" stroke="${cor}" stroke-width="${traco}"/>` +
        `<text x="${x}" y="${Math.max(fonte, y - 2)}" font-family="monospace" font-size="${fonte}" fill="${cor}" stroke="black" stroke-width="0.5">${i + 1}:${Math.round(b.score * 100)}:${Math.round(Math.max(l, a))}</text>`
      );
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">${formas}</svg>`;
  await sharp(caminhoFoto)
    .rotate()
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toFile(destino);
}

function resumo(caixas) {
  const r = {};
  for (const corte of CORTES) {
    const acima = caixas.filter((b) => b.score >= corte);
    const lados = acima.map((b) => Math.round(Math.max(b.l, b.a))).sort((p, q) => p - q);
    r[corte] = {
      detectados: acima.length,
      lado_px: lados.length
        ? {
            min: lados[0],
            p25: lados[Math.floor(lados.length * 0.25)],
            mediana: lados[Math.floor(lados.length * 0.5)],
            max: lados[lados.length - 1],
          }
        : null,
    };
  }
  return r;
}

const arquivos = (await readdir(FOTOS)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
await mkdir(SAIDA, { recursive: true });

const detectores = [await criarYunet(), await criarScrfd()];
const estrategias = [
  ['inteira', estrategiaInteira],
  ['ladrilho', estrategiaLadrilho],
];

const relatorio = [];
for (const arquivo of arquivos) {
  const caminho = path.join(FOTOS, arquivo);
  const { largura, altura } = await lerImagem(caminho);
  const registro = { foto: arquivo, largura, altura, medicoes: {} };
  for (const detector of detectores) {
    for (const [nomeEstrategia, fn] of estrategias) {
      const t0 = Date.now();
      const caixas = await fn(detector, caminho, LIMIAR_COLETA);
      const ms = Date.now() - t0;
      const chave = `${detector.nome}/${nomeEstrategia}`;
      registro.medicoes[chave] = { ms, ...resumo(caixas) };
      const visiveis = caixas.filter((b) => b.score >= 0.5).sort((p, q) => p.y - q.y);
      await anotar(
        caminho,
        visiveis,
        path.join(SAIDA, `${path.parse(arquivo).name}__${detector.nome}_${nomeEstrategia}.jpg`),
        CORES[detector.nome],
      );
      // guarda as caixas cruas para o passo 2 (leave-one-out)
      registro.medicoes[chave].caixas = caixas.map((b) => ({
        x: Math.round(b.x),
        y: Math.round(b.y),
        l: Math.round(b.l),
        a: Math.round(b.a),
        s: Number(b.score.toFixed(3)),
      }));
      console.log(
        `${arquivo.padEnd(34)} ${chave.padEnd(18)} ${String(ms).padStart(6)}ms  ` +
          CORTES.map((c) => `@${c}:${registro.medicoes[chave][c].detectados}`).join('  '),
      );
    }
  }
  relatorio.push(registro);
}

await writeFile(path.join(SAIDA, 'deteccao.json'), JSON.stringify(relatorio, null, 2));
console.log(`\nRelatorio em ${path.join(SAIDA, 'deteccao.json')}`);
