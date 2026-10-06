# Fase 0 — resultado da medição de detecção

> Referente a: [`biometria-facial-on-device.md`](../../_reversa_sdd/sdd/biometria-facial-on-device.md) §6.1 (RF-00, RF-00a), §6.2 (RF-10), §14 (OQ-02)
> Data: `2026-10-05`
> Sonda: `spikes/fase0-deteccao/` — **código descartável**, não é produto
> Dados brutos: `.avaliacao/saida/deteccao.json` e imagens anotadas (fora do git)

> 🟢 **Resposta à pergunta que bloqueava o passo 1: sim, o detector enxerga as
> crianças da foto 03.** 24 rostos encontrados, todos reais, zero falso positivo.
> A detecção **não é o gargalo do projeto**. O risco se deslocou para o
> reconhecimento, e a causa é o tamanho do rosto em pixel — ver §5.

---

## 1. O que foi medido, e o que não foi

Esta medição responde **uma** pergunta: o detector encontra os rostos?
Ela **não** mede reconhecimento, que é o que o critério de abandono da §13 avalia.

| Requisito | Estado |
|---|---|
| 🟢 RF-00 — conjunto de avaliação com ≥10 fotos reais | 13 fotos, dia e noite, adulto e infantil |
| 🟢 RF-00a — comparar candidatos | Feito **para detecção** (YuNet × SCRFD). O requisito pede modelos de *embedding*: pendente |
| 🔴 RF-00b — medir no hardware do professor | **Não feito.** Os tempos abaixo são de máquina de desenvolvimento |
| 🔴 RF-00c — limiar derivado da curva acerto × falso positivo | **Não feito.** Depende do reconhecimento |
| 🔴 RF-00d — veredito formal | **Não emitido.** A Fase 0 continua aberta |

🟡 Nenhum número aqui autoriza construir os requisitos da §6.2.

---

## 2. Taxa de detecção

Configuração: YuNet, imagem inteira reduzida a 640×640, limiar 0,65.

| Foto | Pessoas (rotulagem) | Detectados | Rosto mediano |
|---|---|---|---|
| 01 adulto noite | 8 | 8 | 59 px |
| 02 misto noite | ~15 | 16 | 47 px |
| **03 infantil noite** | **~23** | **24** | **41 px** |
| 04 adulto noite | 7 | 7 | 58 px |
| 05 misto noite | ~14 | 13 | 55 px |
| 06 misto noite | ~18 | 18 | 56 px |
| 07 no-gi noite (sem compressão) | 7 | 7 | **120 px** |
| 08 diurna | 7 | 7 | 53 px |
| 09 diurna | ? | 8 | 43 px |
| 10 diurna (recorte) | 9 | 8 | 42 px |
| 11 diurna | 5 | 5 | 52 px |
| 12 diurna | 5 | 5 | 61 px |
| 13 noturna | ? | 6 | 49 px |
| **Total (11 fotos com contagem confiável)** | **118** | **118** | — |

🟡 **Contagem batendo não é prova de acerto por rosto**: uma perda pode ser
compensada por um falso positivo. Por isso quatro fotos foram conferidas
caixa a caixa na imagem anotada — 03, 06, 08 e 10, escolhidas por serem o
caso infantil, o caso denso, o caso do espelho e o caso do recorte.
Nelas, **toda caixa acima do limiar estava sobre um rosto real**.

### A foto 03, o caso difícil

24 detecções, todas sobre rosto de criança real, nenhum falso positivo.
A criança com a mão na boca (EC-04, rosto parcialmente coberto) foi detectada.
A rotulagem havia estimado 23 pessoas e o próprio rascunho advertia que
aquela contagem era a menos confiável do conjunto — o detector encontrando 24
rostos reais sugere que a contagem humana errou para menos, não que o
detector alucinou.

---

## 3. 🟢 O alarme do espelho estava errado, e a razão é geométrica

O adendo anterior previa que o espelho seria o **modo de falha dominante**,
com o detector vendo ~1,5× o número real de pessoas (~12 rostos para 7 alunos
na foto 08). **Não acontece.**

Os alunos posam **de frente para a câmera**, com o espelho **atrás** deles.
Logo o espelho reflete a **nuca**, não o rosto. Um detector facial ignora nuca
corretamente. Na foto 08: 7 alunos, 7 detecções em 0,92–0,93.

🟡 Reflexo parcial existe, mas é marginal e separável. Nas duas detecções
espúrias da foto 08 a confiança foi 0,55 e 0,61, com 34–36 px, contra 50–58 px
dos rostos reais. O mesmo valeu para a pessoa visível na outra sala pelo vidro
(EC-02, foto 06): 0,53 e 21 px.

🟢 **Consequência:** o EC-12 volta a ser caso de borda. A deduplicação por
identidade continua desejável, mas **deixa de ser requisito de primeira ordem**,
e a recomendação de posicionar a turma de costas para o espelho perde urgência.

> Duas previsões minhas sobre esse ambiente já se mostraram erradas: o
> contraluz diurno, que não existe, e agora o espelho. Ambas erraram no mesmo
> sentido — superestimando a hostilidade do ambiente a partir de descrição
> textual, sem medir. O padrão vale ser lembrado antes da próxima estimativa.

---

## 4. 🟢 Ladrilhamento não se justifica

Hipótese testada: rostos de 40 px exigiriam processar a imagem em janelas de
640 px na resolução nativa, em vez de reduzir a imagem inteira para 640.

| Configuração | Melhor limiar | Acerto de contagem | Patamar estável | Tempo (13 fotos) |
|---|---|---|---|---|
| YuNet, imagem inteira | 0,65 | 118/118 | 0,44 – 0,80 (**0,36**) | **1 381 ms** |
| YuNet, ladrilho | 0,70 | 119/118 | 0,56 – 0,90 (0,34) | 4 963 ms |
| SCRFD, imagem inteira | 0,35 | 118/118 | 0,30 – 0,69 (0,39) | 1 486 ms |
| SCRFD, ladrilho | 0,50 | 118/118 | 0,41 – 0,79 (0,38) | 6 285 ms |

*Patamar estável = faixa de limiar em que a contagem fica a ±5% da verdade.
Patamar largo significa limiar robusto; patamar estreito significa limiar à beira de um precipício.*

🟢 O ladrilho **não melhora** nem a taxa nem a robustez do limiar, e custa
**3,6×** o tempo. A imagem inteira reduzida a 640 é a escolha certa — o que
simplifica o produto.

🟡 Surpreende: ao reduzir 1200×1600 para 640, um rosto de 40 px vira 16 px, e
YuNet ainda o encontra. A cabeça de stride 8 dá conta.

---

## 5. 🔴 O risco real se deslocou: tamanho de rosto para *reconhecer*

Detectar um rosto de 40 px é uma coisa. **Extrair dele um vetor que distinga
uma pessoa de outra é outra, muito mais exigente.** Modelos de embedding
esperam recorte de 112×112. Um rosto de 40 px ampliado para 112×112 não ganha
informação — só interpolação.

E o tamanho que estou medindo **não é propriedade do dojo, é da compressão do WhatsApp**:

| | Rosto mediano |
|---|---|
| 12 fotos comprimidas pelo WhatsApp (≤1,9 MP) | **40 – 61 px** |
| Foto 07, a única em resolução original (9,7 MP) | **120 px** |

🔴 A foto sem compressão tem rosto **2,9× maior**. Toda medição de
reconhecimento feita sobre as 12 comprimidas vai subestimar o sistema real —
e pode produzir um veredito "inviável" que seja artefato do canal de
transferência, não do método.

🟡 Isso promove um item que estava listado como recado menor no handoff a
**pré-requisito do passo 2**: obter as fotos sem recompressão (WhatsApp como
*documento*, cabo, Drive ou e-mail). Antes disso, qualquer número de
reconhecimento tem validade limitada e precisa ser rotulado como tal.

🟡 Para o RF-10 (tamanho mínimo), os dados sugerem corte na casa de **35–40 px**
como piso de detecção. O piso para *reconhecimento* é outro número, maior, e
ainda desconhecido.

---

## 6. Escolha de detector: YuNet

| Critério | YuNet | SCRFD-500M |
|---|---|---|
| **Licença** | 🟢 **MIT**, sem restrição | 🔴 **Não-comercial, só pesquisa** |
| Tamanho | 🟢 227 KB | 2,5 MB |
| Acerto de contagem | 118/118 | 118/118 |
| Distribuição de confiança | 🟢 Bimodal: 110 detecções ≥0,92, vale claro abaixo | 🟡 Espalhada entre 0,70 e 0,92, sem vale |
| Tempo (13 fotos, imagem inteira) | 1 381 ms | 1 486 ms |

🔴 A licença decide sozinha. Os modelos pré-treinados do InsightFace são
liberados **apenas para pesquisa não-comercial** — e isso vale também para o
`w600k_mbf.onnx` de reconhecimento que vem no mesmo pacote. **Não servem para
este produto**, por melhor que fossem.

🟢 Os 227 KB do YuNet deixam praticamente todo o orçamento de 30 MB do RNF-04
livre para o modelo de reconhecimento.

🟡 **Resolve parcialmente a OQ-02** no lado da detecção. O modelo de embedding,
que é o que a OQ-02 realmente pergunta, continua aberto — e agora com uma
restrição a mais: precisa ser de licença permissiva.

---

## 7. Tempo

| | Por foto, imagem inteira |
|---|---|
| YuNet nesta máquina (CPU, onnxruntime-node) | ~106 ms |

🔴 **Isto não cumpre o RF-00b.** É máquina de desenvolvimento, não o aparelho
do professor, e é Node com onnxruntime nativo, não navegador com WASM. O
número serve só para dizer que a detecção não é o termo dominante do
orçamento de 20 s do RNF-03. A medição válida exige o celular dele.

---

## 8. O que fazer a seguir

1. 🔴 **Conseguir as fotos sem recompressão.** Virou pré-requisito do passo 2,
   não recado lateral. Sem isso o reconhecimento é medido em dado degradado.
2. 🟡 **Escolher um modelo de embedding de licença permissiva.** InsightFace
   está fora. Candidatos a avaliar com atenção à licença, não só ao acerto.
3. 🟡 **Ligar caixa detectada a identidade.** Os rótulos em `identidades.json`
   identificam pessoas por `pos` — um número de posição vindo de descrição
   textual, não de caixa delimitadora. O leave-one-out exige um passo manual
   de ligação. As caixas já estão salvas em `deteccao.json`, e as imagens
   anotadas trazem índice, confiança e tamanho, o que torna essa ligação viável.
4. 🟢 **Despriorizar:** rotular as 17 crianças da foto 03 continua útil para o
   reconhecimento, mas **não bloqueia mais** — a pergunta de detecção que
   motivava a urgência já foi respondida.
5. 🟡 **Confirmar com o professor** se as fotos diurnas são outra sala ou outra
   academia. Segue em aberto e colide com "operador único, sem multi-tenant".

---

## Apêndice — reprodutibilidade

```
cd spikes/fase0-deteccao
npm install
node medir.mjs
```

Sonda descartável. Não importar em `packages/` ou `apps/`.
Entradas e saídas ficam em `.avaliacao/`, fora do git.
