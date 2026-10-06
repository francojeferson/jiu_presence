# Avaliação do conjunto de fotos para a Fase 0

> Referente a: [`biometria-facial-on-device.md`](../../_reversa_sdd/sdd/biometria-facial-on-device.md) §6.1, RF-00 e OQ-06
> Data: `2026-10-04`
> Fonte: 7 fotos fornecidas pelo usuário, do dojo real.
>
> ⚠️ **Veredito: o conjunto ainda NÃO habilita a Fase 0.** Falta o essencial — rotulagem de identidade. Detalhes abaixo.

## 1. Inventário

| # | Arquivo | Resolução | Pessoas (aprox.) | Contexto | Dificuldade |
|---|---|---|---|---|---|
| 1 | `2026-09-28 22.38.32` | 868×1156 (1,0 MP) | 8 | Adultos, duas fileiras (4 em pé, 4 ajoelhados) | **Fácil** |
| 2 | `2026-09-29 21.52.14` | 1200×1600 (1,9 MP) | ~16 | Misto adultos + crianças + 1 bebê de colo | Média |
| 3 | `2026-09-29 21.52.15` | 1200×1600 (1,9 MP) | ~23 | **Turma infantil**, maioria criança pequena | **Difícil** |
| 4 | `2026-09-30 22.23.00` | 1280×1268 (1,6 MP) | 7 | Adultos, fileira única, kimono escuro | Fácil |
| 5 | `2026-10-01 21.28.34` | 1600×1200 (1,9 MP) | ~14 | Misto, duas fileiras | Média |
| 6 | `2026-10-01 21.28.35` | 1600×1200 (1,9 MP) | ~20 | Misto, duas fileiras (em pé + sentados) | Média |
| 7 | `2026-10-02 19.28.26` | **2340×4160 (9,7 MP)** | 7 | **No-gi** (camiseta), fileira única | Fácil |

Total aproximado: **95 instâncias de rosto**.

## 2. O que as fotos revelam, e que corrige a spec

### 2.1 O ambiente é MENOS hostil do que eu assumi

O `ideation.md` descreve o dojo como "ativamente hostil ao reconhecimento facial: suor escorrendo, gi cobrindo pescoço e queixo, iluminação de galpão, contraluz, rostos em ângulo e em movimento".

As fotos mostram outra coisa:

- 🟢 **São fotos posadas de fim de aula.** Todo mundo alinhado, parado, olhando para a câmera. Rostos frontais.
- 🟢 **Iluminação uniforme e boa.** Luminárias de LED lineares no teto, luz branca homogênea. Não há contraluz em nenhuma das sete.
- 🟢 **Nada de suor visível** nos rostos. São fotos de encerramento, não de meio de treino.
- 🟢 **O gi não cobre o queixo** em nenhuma foto. A foto 7 é inclusive no-gi.

🟡 **Consequência:** o risco R1 do PRD está **superestimado para as turmas adultas**. A premissa de 85% é mais plausível do que o texto da ideação sugere. Isso não dispensa o spike — dispensa o pessimismo.

### 2.2 A turma infantil é o caso difícil de verdade

A foto 3 isola o problema real:

- ~23 pessoas, a maioria criança pequena, em duas a três fileiras sobrepostas.
- Rostos estimados em **40 a 55 px** de altura (estimativa por inspeção, não medição).
- Várias crianças olhando para os lados, uma com a mão no rosto.
- Crianças pequenas ficam na fileira da frente, mais baixas, parcialmente ocultas umas pelas outras.

🔴 Modelos de embedding facial geralmente esperam entrada de 112×112 px e degradam rápido abaixo de ~80 px. **A turma infantil provavelmente não atinge 85%** com esse enquadramento.

🟡 Isso valida a OQ-05 daquela spec ("o limiar deve ser único ou por turma?") e sugere uma mitigação barata que não estava prevista: **fotografar a turma infantil em duas fotos, mais perto**, usando o RF-17 de `chamada-e-presenca` (mesclar resultados de duas fotos).

### 2.3 Dois edge cases especulados estão CONFIRMADOS

| Edge case | Status | Evidência |
|---|---|---|
| 🟢 **EC-12, reflexo em espelho** | **Confirmado** | A parede direita do dojo é espelhada. Na foto 1 aparece o reflexo de um aluno; na 3 e na 6 há reflexos parciais. O mesmo aluno seria detectado duas vezes. A deduplicação por identidade antes de devolver o resultado deixa de ser precaução e vira requisito. |
| 🟢 **EC-02, mais rostos que matriculados** | **Confirmado** | Nas fotos 3 e 6 há pessoas visíveis através do vidro, em outra sala (iluminação roxa), que não pertencem à turma. Seriam detectadas e precisam ser classificadas como desconhecidas. |

### 2.4 Problema de validade da medição: compressão do WhatsApp

Seis das sete fotos têm ~1,9 MP ou menos. Celulares atuais capturam 12 MP ou mais; a foto 7, com 9,7 MP, é a única que chegou sem recompressão agressiva — e é justamente a que tem os maiores rostos (~115 px estimados).

🔴 **Medir o acerto nessas seis seria medir um problema mais difícil que o real.** Em produção, a imagem vem direto da câmera, sem passar pelo WhatsApp. Um resultado ruim seria ambíguo: o modelo é fraco ou a imagem foi destruída na compressão?

🟡 **Ação:** as fotos do conjunto de avaliação precisam chegar **sem recompressão**. Pelo WhatsApp, enviar como *documento*, não como imagem. Ou usar cabo, Google Drive, ou e-mail.

## 3. O que falta para a Fase 0 começar

| # | Item | Status | Bloqueia |
|---|---|---|---|
| 1 | **Rotulagem de identidade** — quem é cada pessoa, em cada foto | ❌ **Ausente** | **Tudo.** Sem a verdade de referência é impossível medir acerto ou falso positivo. Dá para medir só taxa de detecção. |
| 2 | **Referência por aluno** — a foto de cadastro contra a qual comparar | ❌ Ausente | O matching. Ver mitigação em §4. |
| 3 | Mínimo de 10 fotos (RF-00) | ⚠️ 7 de 10 | Robustez estatística |
| 4 | Variação de condição (dia, contraluz) | ❌ Todas noturnas, mesma luz | A generalização. Pode ser aceitável: ver §5. |
| 5 | Fotos sem recompressão | ⚠️ 1 de 7 | A validade da medição |

## 4. Mitigação para a ausência de foto de cadastro

🟡 Várias pessoas aparecem em **mais de uma foto** — o mesmo professor, os mesmos alunos adultos entre as fotos 2, 5 e 6, por exemplo.

Isso permite uma avaliação **leave-one-out** sem precisar de foto de cadastro: usa-se a ocorrência de uma foto como referência e tenta-se reconhecer a mesma pessoa nas outras. É metodologicamente válido e mede exatamente o que importa — se dois registros do mesmo rosto, capturados em dias diferentes, produzem embeddings próximos.

🔴 **Mas continua dependendo do item 1:** alguém precisa dizer quem é quem.

## 5. Ausência de variação de iluminação — CONFIRMADA COMO LACUNA

🔴 As sete fotos são noturnas, sob a mesma iluminação de LED.

Eu tinha deixado em aberto se isso era lacuna ou precisão: se o professor só desse aula à noite, um conjunto só noturno refletiria a condição real de produção e valeria mais que um conjunto artificialmente diverso.

**Não é o caso. O professor confirmou que existem turmas diurnas.**

Portanto:

- 🔴 **Falta a condição mais adversa de todas.** As fotos mostram uma janela grande ao fundo do tatame, hoje escura. De dia, ela vira fonte de contraluz forte, com os alunos recortados contra a luz — exatamente o cenário do EC-09 de `biometria-facial-on-device`, e o que mais degrada detecção facial.
- 🔴 **Um veredito emitido só com as fotos noturnas aprovaria algo que falha de manhã.** Seria o pior resultado possível: o professor adota, usa bem por duas semanas na turma da noite, tenta na turma da manhã, não funciona, e volta para o papel (risco R3).

🟡 **O conjunto está, por ora, válido apenas para turmas noturnas.** Se a Fase 0 rodar antes de haver fotos diurnas, essa limitação precisa constar no veredito, em letra grande, e o escopo de validação fica restrito ao horário noturno.

## 6. Recomendação

| # | Ação | Quem | Bloqueia |
|---|---|---|---|
| 1 | **Corrigir o rascunho de rotulagem** em `.avaliacao/rotulos/RASCUNHO-rotulagem.md` | professor | Toda a medição de acerto |
| 2 | **Fotografar ao menos 3 turmas diurnas**, com a janela ao fundo no enquadramento | professor | A validade do veredito fora do horário noturno |
| 3 | **Enviar sem compressão** — WhatsApp como *documento*, ou cabo, ou Drive | professor | A validade da medição |
| 4 | **Refotografar a turma infantil em duas tomadas mais próximas** | professor | Saber se o enquadramento resolve o tamanho de rosto |
| 5 | Implementar o pipeline de detecção e medir taxa de detecção | implementação | — (não depende de rótulo) |

🟡 **O item 5 pode começar já.** A taxa de detecção (RF-00, meta ≥ 95%) e a distribuição de tamanho de rosto são mensuráveis sem nenhum nome: bastam as 7 fotos e a contagem de quantas pessoas há em cada uma, que o rascunho já fornece. Isso calibra o RF-10 (tamanho mínimo de rosto) e responde a pergunta mais barata do spike — *o detector ao menos enxerga as crianças?* — antes de qualquer trabalho de rotulagem.

🔴 **Os itens 1 e 2 bloqueiam o veredito.** Sem rótulo não há acerto; sem foto diurna o veredito só vale para a noite.

## 7. Onde as fotos estão

`.avaliacao/fotos/`, renomeadas por turma e data. **Fora do git**, com duas camadas de proteção:

```
.gitignore da raiz   →  .avaliacao/
.avaliacao/.gitignore →  *  (ignora tudo, menos a si mesmo e o README)
```

Verificado: `git check-ignore -v` confirma que os arquivos estão ignorados, e `git status` não os enxerga.

---
Gerado durante o `/reversa-new` expresso, em 2026-10-04.

---

# Adendo — lote 2, 6 fotos (2026-10-05)

Conjunto passa de 7 para **13 fotos**. Cinco diurnas, uma noturna.

| # | Arquivo | Resolução | Pessoas | Contexto |
|---|---|---|---|---|
| 08 | `08-diurna-2026-09-09` | 1200×1599 | 7 | Adultos, gi azul/preto/branco |
| 09 | `09-diurna-2026-09-22a` | 1200×1599 | ? | A conferir |
| 10 | `10-diurna-2026-09-22b` | 1200×577 | 9 + 1 criança | **Recorte**, formato panorâmico |
| 11 | `11-diurna-2026-09-23` | 1200×1599 | 5 | Adultos |
| 12 | `12-diurna-2026-09-29` | 1199×1599 | 5 | Adultos |
| 13 | `13-noturna-2026-10-05` | 1156×868 | ? | A conferir |

## 1. 🟢 Minha previsão de contraluz diurno estava ERRADA

Eu escrevi que a janela ao fundo viraria contraluz forte de dia, e classifiquei isso como "a condição mais adversa de todas". **Não acontece.**

As fotos diurnas são de um **espaço diferente**: parede cinza com dois ventiladores, **parede espelhada inteira atrás dos alunos**, e nenhuma janela no enquadramento. A iluminação continua artificial, de LED. Não há contraluz em nenhuma das cinco.

🟡 Provável segunda sala ou segunda unidade: os alunos também são outros, predominantemente de gi azul, e não coincidem com os das fotos noturnas.

🔴 **Consequência para o escopo:** se há duas salas, o conjunto de avaliação cobre as duas, mas o produto precisa saber disso. Duas salas podem significar duas listas de turma e, eventualmente, duas academias — o que colidiria com a decisão de "operador único, sem multi-tenant" do PRD. **Pergunta aberta para o professor.**

## 2. 🔴 O achado que realmente importa: o espelho domina

Nas fotos diurnas os alunos ficam **de frente para a câmera, com a parede espelhada logo atrás**. Resultado: rostos refletidos aparecem entre e atrás das cabeças reais.

Contagem estimada de rostos refletidos visíveis:

| Foto | Alunos reais | Rostos refletidos no espelho | Total que o detector veria |
|---|---|---|---|
| 08 | 7 | ~4 a 5 | ~12 |
| 10 | 9 | ~3 a 4 | ~13 |
| 11 | 5 | ~3 | ~8 |
| 12 | 5 | ~1 a 2 | ~7 |

🔴 **O EC-12 deixa de ser caso de borda e vira o modo de falha dominante nessa sala.** O detector encontraria cerca de 1,5× o número real de pessoas. Sem deduplicação por identidade, a chamada inflaria a presença — e inflar presença é pior que perder presença, porque corrompe a decisão de graduação sem deixar rastro.

🟡 Implicações concretas, que vão além do que a spec previa:

1. A deduplicação por identidade (já prevista em EC-12) passa de defesa a requisito de primeira ordem.
2. Reflexo costuma ser **menos nítido e mais distante** que o original. O indicador de qualidade por rosto (RF-11) e o tamanho mínimo (RF-10) viram as ferramentas principais de descarte, não apenas sinalizadores.
3. Vale avaliar uma mitigação de produto, barata e fora do software: **orientar o professor a posicionar a turma de costas para o espelho**, não de frente. Resolve o problema na origem.

## 3. Outros pontos do lote 2

- 🟡 **Foto 10 é um recorte** (1200×577, proporção panorâmica). Já perdeu informação antes de chegar. Serve para contagem, mas não deve entrar na medição de tamanho de rosto.
- 🟢 **Foto 10 tem um caso difícil excelente**: uma criança pequena quase totalmente oculta entre dois adultos, com só parte do rosto visível. É exatamente o EC-04 (rosto parcialmente coberto).
- ⚠️ **Todas as 6 continuam comprimidas pelo WhatsApp** (~1,9 MP ou menos). O professor informou que por ora só tem esse caminho. A limitação de validade da medição, descrita na seção 2.4, permanece.

## 4. Estado do conjunto após o lote 2

| Requisito RF-00 | Antes | Agora |
|---|---|---|
| Mínimo de 10 fotos | ⚠️ 7 | 🟢 **13** |
| Turma diurna | ❌ ausente | 🟢 **5 fotos** |
| Variação de condição | ❌ só noite | 🟡 dia e noite, mas **sem contraluz em nenhuma** |
| Rotulagem de identidade | ⚠️ 60 de 95 | ⚠️ **60 de ~140**, lote 2 sem rótulo |
| Sem compressão | ⚠️ 1 de 7 | ⚠️ 1 de 13 |

🟢 O requisito de quantidade está atendido e o de turma diurna também.
🔴 O gargalo continua sendo **rotulagem**, agora maior: o lote 2 adicionou ~45 instâncias sem rótulo.
