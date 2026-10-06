# Sonda descartavel — Fase 0, deteccao facial

> ⚠️ **Isto nao e codigo de produto.** E uma sonda de spike, escrita para
> responder uma pergunta e ser jogada fora. Nao importe nada daqui em
> `packages/` ou `apps/`. A saida desta sonda e o relatorio em
> `_reversa_forward/001-fundacao-e-chamada-manual/fase0-deteccao-resultado.md`.

## Como rodar

```
npm install
node medir.mjs
```

Le as fotos de `.avaliacao/fotos/` e escreve em `.avaliacao/saida/`:
imagens anotadas com as caixas e `deteccao.json` com as caixas cruas.
**As duas pastas estao fora do git** e devem continuar assim — contem
rostos de alunos, incluindo menores.

## Modelos

Baixados em `modelos/`, tambem fora do git por peso.

| Modelo | Origem | Tamanho | Licenca |
|---|---|---|---|
| `yunet_2023mar.onnx` | OpenCV Zoo | 227 KB | **MIT**, sem restricao |
| `buffalo_sc/det_500m.onnx` | InsightFace | 2,5 MB | **nao-comercial**, so pesquisa |
| `buffalo_sc/w600k_mbf.onnx` | InsightFace | 13,6 MB | **nao-comercial**, so pesquisa |

Para rebaixar os modelos:

```
curl -L -o modelos/yunet_2023mar.onnx \
  https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
curl -L -o modelos/buffalo_sc.zip \
  https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_sc.zip
```
