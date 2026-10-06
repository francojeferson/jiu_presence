# HANDOFF — retomada da sessão

> **Palavra-chave de retomada: `FASE0-BIOMETRIA`**
>
> Digite isso em uma sessão nova. O agente deve ler este arquivo primeiro,
> depois `fase0-deteccao-resultado.md` (ao lado deste), e só então
> `_reversa_sdd/sdd/biometria-facial-on-device.md` §6.1.

Data: `2026-10-05` · Projeto: JiuPresence · Feature ativa: `001-fundacao-e-chamada-manual`

> **Atualizado após a medição de detecção da Fase 0.**
> O passo 1 do plano anterior está concluído. Dois bloqueios que constavam
> aqui eram falsos e foram removidos; um bloqueio novo e real apareceu.

---

## Em uma frase

A feature 001 está **entregue e verificada**. Na Fase 0, a **detecção foi
medida e não é o gargalo** — o detector encontra inclusive as crianças da
foto 03. O risco migrou para o **reconhecimento**, e o que o limita é o
tamanho do rosto em pixel, que hoje é artefato da compressão do WhatsApp.
**Nenhum veredito da Fase 0 foi emitido.**

---

## Estado verificado da feature 001

Tudo abaixo foi executado, não presumido:

```
pnpm typecheck    9/9 pacotes
pnpm arch         0 erros
pnpm test         207/207
pnpm --filter @jiupresence/web run e2e    4/4 (1 fixme)
next build        8 rotas · First Load JS 224 kB
cobertura domínio 98,94%
git status nos caminhos do Flutter: vazio
```

`actions.md`: 64/64 fechadas. `.reversa/state.json` → `stage: done`.

### O que o app faz
PWA instalável que abre e faz a chamada completa **sem rede**. Cadastro de
alunos com escala de faixa derivada da idade, turmas, matrículas, chamada
manual, outbox com idempotência, tela de pendências.

### O que não faz
Reconhecimento facial (porta declarada, sem implementação), graduação,
relatórios PDF.

---

## Fase 0 — o que já foi medido

> Detalhe completo em [`fase0-deteccao-resultado.md`](./fase0-deteccao-resultado.md).
> Sonda descartável em `spikes/fase0-deteccao/`. Dados brutos em
> `.avaliacao/saida/deteccao.json`, fora do git.

### 🟢 Detecção: resolvida

| | |
|---|---|
| Acerto de contagem | **118/118** nas 11 fotos com contagem confiável |
| Foto 03, turma infantil | **24 detecções, todas em rosto real, zero falso positivo** |
| Conferência caixa a caixa | Fotos 03, 06, 08 e 10, nas imagens anotadas |
| Detector escolhido | **YuNet** (OpenCV Zoo), 227 KB, **MIT** |
| Configuração | Imagem inteira reduzida a 640×640, limiar **0,65** |

🟢 O EC-04 (rosto parcialmente coberto) aconteceu de verdade na foto 03 e foi
detectado: a criança com a mão na boca.

### 🔴 SCRFD e todo o InsightFace estão fora, por licença

Os modelos pré-treinados do InsightFace são **"non-commercial research
purposes only"**. Isso vale para o `det_500m` de detecção **e para o
`w600k_mbf` de reconhecimento**, que vem no mesmo pacote e seria o candidato
óbvio do passo 2. **Não servem para este produto.** O modelo de embedding
precisa ser caçado com licença permissiva como critério de entrada, não como
conferência final.

---

## Dois bloqueios anteriores que eram FALSOS

Removidos daqui para não continuarem orientando decisão.

### 🟢 "O espelho domina as fotos diurnas" — errado

A previsão era de ~1,5× o número real de pessoas, ~12 rostos para 7 alunos na
foto 08. Não acontece, por geometria: os alunos posam **de frente para a
câmera**, com o espelho **atrás**. O espelho reflete a **nuca**, e detector
facial ignora nuca. Foto 08: 7 alunos, 7 detecções em 0,92–0,93.

O EC-12 volta a ser caso de borda. Deduplicação por identidade continua
desejável, mas **não é requisito de primeira ordem**, e orientar o professor a
posicionar a turma de costas para o espelho perde urgência.

### 🟢 "Falta rotular as 17 crianças da foto 03" — não bloqueia mais

Era o bloqueio de maior prioridade porque se temia que o detector não
enxergasse as crianças. Ele enxerga. O rótulo continua útil para medir
reconhecimento na turma infantil, mas **saiu do caminho crítico**.

> ⚠️ Padrão a lembrar: três previsões sobre a hostilidade deste ambiente já
> foram desmentidas pela medição — o contraluz diurno, o espelho e a
> necessidade de ladrilhamento. **Todas erraram no mesmo sentido**,
> superestimando a dificuldade a partir de descrição textual. Antes da próxima
> estimativa sobre esse dojo, medir primeiro.

---

## 🔴 O bloqueio NOVO e real: a compressão determina o tamanho do rosto

| | Rosto mediano |
|---|---|
| 12 fotos comprimidas pelo WhatsApp (≤1,9 MP) | **40 – 61 px** |
| Foto 07, a única em resolução original (9,7 MP) | **120 px** |

Detectar um rosto de 40 px é fácil. **Extrair dele um vetor que distinga uma
pessoa de outra é muito mais exigente** — modelos de embedding esperam recorte
de 112×112, e ampliar 40 px não cria informação, só interpola.

🔴 **Medir reconhecimento nas 12 fotos comprimidas pode produzir um veredito
"inviável" que seja artefato do canal de transferência, não do método.** Isso
promove o item de fotos sem recompressão de recado lateral a **pré-requisito
do passo 2**.

O professor informou que por ora só tem WhatsApp como imagem. Caminhos que
preservam o original: enviar pelo WhatsApp **como documento**, cabo, Google
Drive ou e-mail.

---

## Próximos passos, em ordem

### 1. 🔴 Fotos sem recompressão — decisão do professor, bloqueia o passo 2
Pelo menos um lote novo pelos caminhos acima. Sem isso, o leave-one-out roda,
mas o número que sair precisa ser rotulado como pessimista e de validade
limitada.

### 2. 🔴 Escolher modelo de embedding com licença permissiva
InsightFace está fora. A escolha é agora tanto jurídica quanto técnica, e
decide a OQ-01 (dimensão N do vetor), que por sua vez destrava o schema em
`fundacao-arquitetural.md`.

### 3. 🟡 Ligar caixa detectada a identidade
Os rótulos em `identidades.json` identificam pessoas por `pos`, um número de
posição vindo de descrição textual ("fileira de trás, 4º da esquerda"), **não
de caixa delimitadora**. O leave-one-out exige um passo manual de ligação. As
caixas já estão salvas em `deteccao.json`, e as imagens anotadas em
`.avaliacao/saida/` trazem índice, confiança e tamanho — o que torna a ligação
viável, mas é trabalho humano.

### 4. 🟡 Perguntas abertas ao professor
- As fotos diurnas são outra **SALA** ou outra **ACADEMIA**? Segue em aberto e
  colide com a decisão de "operador único, sem multi-tenant" do PRD.
- Rotular o lote 2 (fotos 08 a 13, ~45 instâncias).
- Rotular as 17 crianças da foto 03 — agora opcional, ver acima.

### 5. Só então: veredito formal
Critério de abandono em `biometria-facial-on-device.md` §13. Três saídas:
viável · viável com escopo reduzido · inviável. **Inviável também é conclusão
válida** — o PWA com chamada manual já é um produto de pé.

---

## Estado dos requisitos da Fase 0 (§6.1)

| Requisito | Estado |
|---|---|
| 🟢 RF-00 — conjunto com ≥10 fotos reais | 13 fotos, dia e noite, adulto e infantil |
| 🟡 RF-00a — comparar candidatos | Feito **para detecção**. O requisito pede modelos de *embedding*: pendente |
| 🔴 RF-00b — medir no hardware do professor | **Não feito.** Os 106 ms/foto são de desktop em Node, não de celular em WASM |
| 🔴 RF-00c — limiar da curva acerto × falso positivo | **Não feito.** Depende do reconhecimento |
| 🔴 RF-00d — veredito formal | **Não emitido** |

🟡 **Nenhum número obtido até aqui autoriza construir os requisitos da §6.2.**

🟡 Para o RF-10 (tamanho mínimo de rosto), os dados sugerem piso de **35–40 px**
para *detecção*. O piso para *reconhecimento* é maior e ainda desconhecido.

---

## Coisas descobertas que não estão óbvias no código

1. **A ideação exagerou a hostilidade do ambiente.** "Suor, gi cobrindo o
   queixo, contraluz, movimento" não corresponde às fotos: poses de fim de
   aula, luz uniforme de LED, rostos frontais. O risco R1 está superestimado.

2. **Reduzir a imagem inteira para 640 bate o ladrilhamento.** Ladrilhar em
   resolução nativa não melhora nem a taxa nem a robustez do limiar, e custa
   3,6× o tempo. Ao reduzir 1200×1600 para 640 um rosto de 40 px vira 16 px, e
   a cabeça de stride 8 do YuNet ainda o encontra.

3. **YuNet tem distribuição de confiança bimodal, SCRFD não.** 110 detecções
   acima de 0,92 e um vale claro abaixo, contra uma distribuição espalhada
   entre 0,70 e 0,92. Isso é o que torna o limiar do YuNet robusto, e importa
   mais que qualquer diferença de acerto entre os dois.

4. **Falso positivo é separável por confiança E por tamanho.** Reflexos
   parciais e a pessoa na outra sala pelo vidro (EC-02) saíram em 0,53–0,61
   com 21–36 px, contra ≥0,85 e 35–69 px dos rostos reais.

5. **Mitigação barata para a turma infantil, não prevista na spec:**
   fotografar em duas tomadas mais próximas, usando o RF-17 de
   `chamada-e-presenca` (mesclar resultados de duas fotos).

6. **O `clientsClaim` do service worker é armadilha.** Deixá-lo `false` impede
   o app de abrir offline. Quem evita troca de versão no meio da chamada é o
   `skipWaiting`, não ele. Só o e2e pegou isso.

7. **O teste de arquitetura pode dar falso-positivo.** Na primeira verificação
   negativa ele passou com a importação proibida, porque o pacote alvo ainda
   não existia. Refazer a verificação negativa de vez em quando é obrigatório,
   e o `README.md` do app documenta como.

---

## Decisões ainda pendentes do professor

1. Escala infantil e idade de corte — assumido 16 anos, branca/cinza/amarela/laranja/verde
2. Graus dentro da faixa entram no modelo?
3. Aulas mínimas por faixa para graduação
4. Onde ficam as fotos originais a longo prazo (hoje em `.avaliacao/`, fora do git)

---

## Como NÃO quebrar nada

- O projeto Flutter em `lib/`, `test/`, `supabase/`, `docs/`, `web/`,
  `windows/` é **legado intocável**. A remoção tem 10 critérios em
  `descomissionamento-do-legado.md`; **zero foram atendidos**. Faltam as 5
  chamadas em aula real e as 4 semanas sem o papel.
- `.avaliacao/` nunca vai para o git — fotos **e** saídas da sonda. Verificar com
  `git check-ignore -v .avaliacao/saida/deteccao.json`
- `spikes/fase0-deteccao/` é **código descartável**. Não importar nada dali em
  `packages/` ou `apps/`. Seu `.gitignore` exclui `modelos/` e `node_modules/`.
- `.reversa/reversa-config.json` está com `allowLegacyEdits: true` e
  `allowedPaths: []` — **liberação irrestrita**. Isso permite escrever em
  qualquer lugar; não significa que se deva.
