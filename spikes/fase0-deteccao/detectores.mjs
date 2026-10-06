// DESCARTAVEL — sonda da Fase 0. Nao e codigo de produto.
// Pre e pos-processamento de YuNet (OpenCV Zoo) e SCRFD-500M (InsightFace).
import ort from 'onnxruntime-node';
import sharp from 'sharp';

export const LADO = 640; // ambos os modelos rodam em 640x640

// ---------- utilitarios de imagem ----------

/** Le a imagem e devolve RGB cru, sem redimensionar. */
export async function lerImagem(caminho) {
  const img = sharp(caminho).rotate(); // respeita o EXIF do celular
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`esperava 3 canais, veio ${info.channels}`);
  return { rgb: data, largura: info.width, altura: info.height };
}

/**
 * Recorta uma janela LADOxLADO do RGB cru, preenchendo com preto o que faltar.
 * Serve tanto para ladrilho (recorte nativo) quanto para imagem inteira (ja reduzida).
 */
export function recortarJanela(rgb, largura, altura, x0, y0) {
  const saida = new Uint8Array(LADO * LADO * 3);
  for (let y = 0; y < LADO; y++) {
    const yOrig = y0 + y;
    if (yOrig < 0 || yOrig >= altura) continue;
    for (let x = 0; x < LADO; x++) {
      const xOrig = x0 + x;
      if (xOrig < 0 || xOrig >= largura) continue;
      const o = (yOrig * largura + xOrig) * 3;
      const d = (y * LADO + x) * 3;
      saida[d] = rgb[o];
      saida[d + 1] = rgb[o + 1];
      saida[d + 2] = rgb[o + 2];
    }
  }
  return saida;
}

/** Reduz a imagem inteira para caber em LADOxLADO preservando proporcao. Devolve a escala. */
export async function reduzirParaJanela(caminho) {
  const { rgb, largura, altura } = await lerImagem(caminho);
  const escala = LADO / Math.max(largura, altura);
  const novaL = Math.round(largura * escala);
  const novaA = Math.round(altura * escala);
  const reduzida = await sharp(rgb, { raw: { width: largura, height: altura, channels: 3 } })
    .resize(novaL, novaA)
    .raw()
    .toBuffer();
  return { janela: recortarJanela(reduzida, novaL, novaA, 0, 0), escala, largura, altura };
}

// ---------- tensores ----------

/** NCHW, canais em BGR, valores crus 0-255. E o que o blobFromImage da OpenCV entrega ao YuNet. */
function tensorBgrCru(janela) {
  const n = LADO * LADO;
  const t = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    t[i] = janela[i * 3 + 2]; // B
    t[n + i] = janela[i * 3 + 1]; // G
    t[2 * n + i] = janela[i * 3]; // R
  }
  return new ort.Tensor('float32', t, [1, 3, LADO, LADO]);
}

/** NCHW, canais em RGB, (x - 127.5) / 128. E o que o InsightFace entrega ao SCRFD. */
function tensorRgbNormalizado(janela) {
  const n = LADO * LADO;
  const t = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    t[i] = (janela[i * 3] - 127.5) / 128;
    t[n + i] = (janela[i * 3 + 1] - 127.5) / 128;
    t[2 * n + i] = (janela[i * 3 + 2] - 127.5) / 128;
  }
  return new ort.Tensor('float32', t, [1, 3, LADO, LADO]);
}

// ---------- pos-processamento ----------

const STRIDES = [8, 16, 32];

/**
 * YuNet 2023mar. Segue modules/objdetect/src/face_detect.cpp da OpenCV:
 * score = sqrt(cls * obj); centro = (coluna + dx) * stride; lado = exp(d) * stride.
 */
function posYunet(saidas, limiar) {
  const caixas = [];
  for (const s of STRIDES) {
    const cls = saidas[`cls_${s}`].data;
    const obj = saidas[`obj_${s}`].data;
    const bbox = saidas[`bbox_${s}`].data;
    const colunas = LADO / s;
    const linhas = LADO / s;
    for (let r = 0; r < linhas; r++) {
      for (let c = 0; c < colunas; c++) {
        const i = r * colunas + c;
        const pCls = Math.min(Math.max(cls[i], 0), 1);
        const pObj = Math.min(Math.max(obj[i], 0), 1);
        const score = Math.sqrt(pCls * pObj);
        if (score < limiar) continue;
        const cx = (c + bbox[i * 4]) * s;
        const cy = (r + bbox[i * 4 + 1]) * s;
        const l = Math.exp(bbox[i * 4 + 2]) * s;
        const a = Math.exp(bbox[i * 4 + 3]) * s;
        caixas.push({ x: cx - l / 2, y: cy - a / 2, l, a, score });
      }
    }
  }
  return caixas;
}

/**
 * SCRFD-500M. Segue scrfd.py do InsightFace: 2 ancoras por celula,
 * bbox predito em distancias ao centro da ancora, multiplicadas pelo stride.
 */
function posScrfd(saidas, nomes, limiar) {
  const caixas = [];
  for (let k = 0; k < STRIDES.length; k++) {
    const s = STRIDES[k];
    const scores = saidas[nomes[k]].data;
    const dists = saidas[nomes[k + 3]].data;
    const colunas = LADO / s;
    const linhas = LADO / s;
    const ancoras = scores.length / (colunas * linhas);
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] < limiar) continue;
      const celula = Math.floor(i / ancoras);
      const r = Math.floor(celula / colunas);
      const c = celula % colunas;
      const cx = c * s;
      const cy = r * s;
      const x1 = cx - dists[i * 4] * s;
      const y1 = cy - dists[i * 4 + 1] * s;
      const x2 = cx + dists[i * 4 + 2] * s;
      const y2 = cy + dists[i * 4 + 3] * s;
      caixas.push({ x: x1, y: y1, l: x2 - x1, a: y2 - y1, score: scores[i] });
    }
  }
  return caixas;
}

// ---------- NMS ----------

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.l, b.x + b.l);
  const y2 = Math.min(a.y + a.a, b.y + b.a);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter <= 0) return 0;
  return inter / (a.l * a.a + b.l * b.a - inter);
}

export function nms(caixas, limiar = 0.4) {
  const ordenadas = [...caixas].sort((p, q) => q.score - p.score);
  const mantidas = [];
  for (const cand of ordenadas) {
    if (mantidas.every((m) => iou(cand, m) < limiar)) mantidas.push(cand);
  }
  return mantidas;
}

// ---------- detectores ----------

export async function criarYunet() {
  const sessao = await ort.InferenceSession.create('./modelos/yunet_2023mar.onnx');
  return {
    nome: 'yunet',
    async detectar(janela, limiar) {
      const saidas = await sessao.run({ input: tensorBgrCru(janela) });
      return posYunet(saidas, limiar);
    },
  };
}

export async function criarScrfd() {
  const sessao = await ort.InferenceSession.create('./modelos/buffalo_sc/det_500m.onnx');
  const nomes = sessao.outputNames; // [score x3, bbox x3, kps x3]
  const entrada = sessao.inputNames[0];
  return {
    nome: 'scrfd',
    async detectar(janela, limiar) {
      const saidas = await sessao.run({ [entrada]: tensorRgbNormalizado(janela) });
      return posScrfd(saidas, nomes, limiar);
    },
  };
}

// ---------- estrategias ----------

/** Imagem inteira reduzida para 640. O caminho ingenuo. */
export async function estrategiaInteira(detector, caminho, limiar) {
  const { janela, escala } = await reduzirParaJanela(caminho);
  const caixas = await detector.detectar(janela, limiar);
  // volta para coordenadas da imagem original
  return nms(
    caixas.map((b) => ({ ...b, x: b.x / escala, y: b.y / escala, l: b.l / escala, a: b.a / escala })),
  );
}

/** Posicoes de ladrilho de 640 com sobreposicao, cobrindo a dimensao inteira. */
function posicoesLadrilho(dimensao, passo = 480) {
  if (dimensao <= LADO) return [0];
  const posicoes = [];
  for (let p = 0; p + LADO < dimensao; p += passo) posicoes.push(p);
  posicoes.push(dimensao - LADO);
  return [...new Set(posicoes)];
}

/** Ladrilhos de 640 na resolucao nativa. Preserva o tamanho real do rosto. */
export async function estrategiaLadrilho(detector, caminho, limiar) {
  const { rgb, largura, altura } = await lerImagem(caminho);
  const todas = [];
  for (const y0 of posicoesLadrilho(altura)) {
    for (const x0 of posicoesLadrilho(largura)) {
      const janela = recortarJanela(rgb, largura, altura, x0, y0);
      const caixas = await detector.detectar(janela, limiar);
      for (const b of caixas) todas.push({ ...b, x: b.x + x0, y: b.y + y0 });
    }
  }
  return nms(todas);
}
