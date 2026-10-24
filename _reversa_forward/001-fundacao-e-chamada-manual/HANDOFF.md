# HANDOFF — retomada da sessão

# 🔑 `RETOMAR-JIUPRESENCE`

**É a única palavra-chave necessária.** Digite-a numa sessão nova.

Prompt sugerido, para copiar e colar:

> RETOMAR-JIUPRESENCE. Leia `_reversa_forward/001-fundacao-e-chamada-manual/HANDOFF.md`
> e `_reversa_refactor/pendencias-abertas.md`, confirme o estado do Git e me
> diga qual trilha você vai seguir antes de mudar qualquer coisa.

## O que o agente deve fazer, nesta ordem

1. **Ler [`_reversa_refactor/pendencias-abertas.md`](../../_reversa_refactor/pendencias-abertas.md).**
   É o registro vivo do que está aberto — e, igualmente importante, do que
   **não** deve ser reaberto. As auditorias datadas são fotografias; não
   comece por elas.
2. **Conferir o estado do Git contra o esperado** (abaixo). Se não bater,
   alguém mexeu depois: descubra o que antes de agir.
3. **Rodar a verificação antes de alterar qualquer coisa**, para saber se o
   ponto de partida está verde:
   ```bash
   pnpm typecheck && pnpm test
   ```
4. **Escolher UMA trilha e dizer qual**, antes de começar.
5. **Respeitar a regra do Reversa:** antes de escrever fora das pastas
   próprias, ler `.reversa/reversa-config.json` e obedecer `allowLegacyEdits`
   e `allowedPaths`.

## Estado esperado ao retomar

Se algum número divergir, o repositório andou desde o último handoff — e o que
está escrito aqui pode ter envelhecido junto.

```
main == origin/main, árvore limpa
pnpm typecheck    9 tarefas, todas verdes
pnpm test         241 testes — domain 99, application 42, infrastructure 100
pnpm build        5 tarefas, 8 rotas
pnpm arch         0 violações, 52 módulos, 102 dependências — sem aviso
pnpm audit --prod 1 alta restante (zod 3, item 8 do registro), 0 críticas
pnpm e2e          23/23 com Supabase local de pé; sem ele, 2 são ignorados
```

> Tudo acima, exceto o `e2e`, foi **medido em 2026-10-24 com `--force`**, sem
> cache do turbo. Duas linhas mudaram em relação ao handoff anterior: o aviso
> de `test/setup.ts` órfão no `arch` **não existe mais**, e o `audit` deixou de
> ser zero — ver a entrada de segurança abaixo. O `e2e` não foi reexecutado
> nesta sessão por depender de Docker.

Produção, conferível sem credencial nenhuma:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://jiu-presence.vercel.app/entrar   # 200
curl -s -o /dev/null -w '%{http_code}\n' https://jiu-presence.vercel.app/sw.js    # 200
curl -s https://zjqyoivjirnveyrubakv.supabase.co/auth/v1/settings \
  -H "apikey: sb_publishable_BzKMJBu8Nm9pnyAIsjvxyg_pllbK9zA" | grep -o '"disable_signup":[a-z]*'   # true
```

Se `disable_signup` voltar `false`, alguém reabriu o cadastro: feche antes de
qualquer outra coisa. A chave acima é pública por desenho — ela viaja no bundle
JavaScript, e quem protege os dados é a RLS.

> O "14 tarefas" anotado antes vinha de uma corrida que listava os `build`
> intermediários; `turbo` reporta **9**. A contagem de testes é o sinal
> confiável de deriva, não essa.

Sem SHA de propósito: um hash anotado no arquivo que o próprio commit escreve
nasce errado. As contagens de teste são o sinal de deriva que funciona, e
`git log --oneline -8` mostra se a sessão terminou onde este handoff diz.

Para o E2E completo é preciso Docker e `pnpm exec supabase start --workdir infra`.

---

## Produção

> **No ar desde 2026-10-24.** Antes desta data o projeto nunca tinha sido
> implantado, e "ambientes implantados nunca exercitados" era o maior risco
> residual registrado em [`pendencias-abertas.md`](../../_reversa_refactor/pendencias-abertas.md).

| | |
|---|---|
| URL de produção | **https://jiu-presence.vercel.app** |
| Projeto Supabase | `jiu-presence-sp` · ref **`zjqyoivjirnveyrubakv`** · **`sa-east-1`** (São Paulo) · plano free, compute Nano |
| Projeto Vercel | `jiu-presence`, time `jeferson-francos-projects`, Root Directory `apps/web`, preset Next.js |
| Operador provisionado | `jfranco.adm@gmail.com` |

### Armadilhas que custaram tempo e vão custar de novo

**1. Usuário no Auth não basta: sem linha em `operador`, tudo falha em
silêncio.** As políticas da migração `0005` exigem `EXISTS (SELECT 1 FROM
operador WHERE id = auth.uid())`. Com o usuário criado mas sem a linha
espelhada, todo `INSERT` volta **403 `42501`** e toda leitura volta vazia. E
como 403 cai no ramo final de [`classificacao.ts`](../../packages/infrastructure/src/sync/classificacao.ts)
— "código não previsto é transitório por desenho" — a outbox **espera em vez de
reclamar**. A tela mostra "N registros aguardando envio" e parece problema de
rede. É o passo 4 do `README.md` do app, e é o primeiro lugar para olhar se
nada sobe.

**2. A fila demora mais que a sua paciência.** Depois de corrigir a causa, os
itens sobem sozinhos, mas não instantaneamente — há espera exponencial. Medir o
servidor 12 segundos depois e ver tabela vazia **não** é prova de perda de
dado. Consulte de novo antes de abrir investigação; nesta sessão isso gerou um
alarme falso de perda silenciosa.

**3. A URL do deployment é protegida, a de produção não.** `jiu-presence-<hash>-
<time>.vercel.app` passa por Vercel Authentication e redireciona o
`manifest.json` para `vercel.com/sso-api`. Quem estiver logado na Vercel não
percebe. **Teste sempre no domínio de produção, e num contexto de navegador sem
os cookies da Vercel** — foi assim que se confirmou que o professor consegue
abrir.

**4. `NEXT_PUBLIC_SUPABASE_ANON_KEY` guarda uma chave `sb_publishable_…`, não um
JWT.** A Supabase parou de oferecer a anon key legada em projeto novo. Funciona
sem tocar em código: `supabase-js` 2.117.2 repassa a chave opaca, e
[`cliente.ts`](../../packages/infrastructure/src/supabase/cliente.ts) não
decodifica nada. O nome da variável continua o antigo de propósito.

### Como aplicar migração no projeto hospedado

Conexão direta (`db.<ref>.supabase.co`) é **IPv6-only**. Em rede IPv4 use o
*session pooler*, porta 5432 — modo sessão, não transação, que é o certo para
DDL:

```bash
pnpm exec supabase db push --dry-run --workdir infra \
  --db-url "postgresql://postgres.zjqyoivjirnveyrubakv:<SENHA-PERCENT-ENCODED>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

`--db-url` dispensa `supabase login`, o que também imuniza contra instabilidade
da Management API. Rode com `--dry-run` primeiro: ele prova a conexão e lista o
que subiria. Para conectar com `pg` em script, a verificação de TLS exige a CA
da Supabase (`prod-ca-2021.crt`, link em Settings → Database); não desligue
`rejectUnauthorized`.

> ⚠️ Existe um projeto **`jiu-presence` pausado em `us-west-2`**, ref
> `frvnuwgufbnsykgiqcyv`. Não é este. Foi mantido intocado por não se saber se
> era o do Flutter legado. A região de um projeto Supabase não pode ser
> trocada depois de criado — foi por isso que se criou um novo.

## Trilhas

As duas são independentes. A escolha é do usuário, não do agente.

| Trilha | Primeiro passo | Leitura específica |
|---|---|---|
| **Uso real** | **a mais valiosa hoje.** O sistema está em produção e só foi exercitado no desktop. Instalar o PWA num celular, rodar uma chamada de turma inteira numa aula de verdade, e ver o que quebra. Também é o que faz o relógio de 4 semanas do CV-08 andar | a seção "Produção" acima |
| **Decisões do professor** | duas perguntas de trinta segundos que ficam mais caras a cada aluno cadastrado: carência de edição (premissa: 24h) e escala infantil (premissa: corte aos 16) | itens 1 e 2 do registro |
| **Dívida** | **esgotada.** Nenhuma dívida de código. O que resta no item 4 do registro precisa de aparelho na mão, não de código | só o registro |
| **Produto** | biometria — travada em dados e licença, não em código | este arquivo → [`fase0-deteccao-resultado.md`](./fase0-deteccao-resultado.md) → `_reversa_sdd/sdd/biometria-facial-on-device.md` §6.1 |

> Palavras-chave antigas continuam funcionando e caem aqui:
> `RETOMAR-POSTCSS` (**fechado em 2026-10-11**, ver o fim do registro) e
> `FASE0-BIOMETRIA` (a trilha de produto).

---

Data: `2026-10-24` · Projeto: JiuPresence · Feature ativa: `001-fundacao-e-chamada-manual`

> **Atualizado após a primeira implantação em produção.**
> O sistema saiu do laptop: Supabase em São Paulo e Vercel, com dado real
> dentro. Nada da Fase 0 mudou — a biometria continua exatamente onde parou.
> O que mudou é que o maior risco residual do projeto deixou de ser risco, e
> três armadilhas de ambiente implantado foram descobertas na prática e estão
> registradas na seção "Produção".

---

## Em uma frase

A feature 001 está **entregue, verificada e em produção** desde 2026-10-24,
com o primeiro aluno e a primeira chamada reais gravados em São Paulo. Na
Fase 0, a **detecção foi medida e não é o gargalo** — o detector encontra
inclusive as crianças da foto 03. O risco migrou para o **reconhecimento**, e
o que o limita é o tamanho do rosto em pixel, que hoje é artefato da
compressão do WhatsApp. **Nenhum veredito da Fase 0 foi emitido.**

---

## Endurecimento — 2026-10-11

> Sessão de auditoria e correção, numa trilha paralela à Fase 0. **Nada abaixo
> desta seção foi invalidado**: a biometria continua exatamente onde parou.
>
> Relatório completo: [`_reversa_refactor/auditoria-ponytail-2026-10-11.md`](../../_reversa_refactor/auditoria-ponytail-2026-10-11.md)
>
> Branch: `auditoria/correcoes-e-cobertura`

Treze achados corrigidos, mais três corridas de concorrência descobertas ao
escrever os testes. O mais grave: uma violação de chave estrangeira era sempre
transitória, então uma dependência recusada em definitivo **congelava a fila
inteira em silêncio** — a tela só dizia "aguardando envio", igual a estar
offline.

Também corrigidos: o pré-cache do PWA não tinha **nenhum documento HTML** (só
abria offline a página já visitada, e `/offline` nem podia ser servida); a saída
da conta, que não existia, hoje apaga o cache sem jamais tocar na outbox; e duas
abas deixaram de enviar o mesmo item duas vezes.

Mudanças de API que afetam quem for mexer no código:

- `SincronizadorOutbox.parar()` — novo, **obrigatório** antes de descartar o
  container, senão a instância antiga continua escutando a fila.
- `classificar(resposta, tipo, tentativas)` — terceiro argumento, opcional.
- `limparCacheComFilaVazia()` em `local/outbox.ts` — a única forma correta de
  limpar o cache.
- Removidos por não terem chamador: `Faixa.proxima`/`ehMaxima`,
  `Aluno.renomear`/`alterarFaixa`/`registrarGraduacao`/`idadeEm`,
  `Chamada.reabrir`, `DataCivil.brasileiro`, `instanteDoId`,
  `Outbox.temItemEmVoo`, portas `chamadas.listarRecentes` e
  `matriculas.daTurma`, tipo de operação `inativar_aluno`. Voltam em 5 linhas
  quando a feature que os justifica chegar.

⚠️ **Antes de escrever E2E aqui**, leia a seção "Armadilhas de teste" do
relatório. Cinco delas custaram tempo nesta sessão e vão custar de novo.

---

## Estado verificado da feature 001

Tudo abaixo foi executado, não presumido (números de 2026-10-11):

```
turbo typecheck   14 tarefas
turbo arch        0 erros (1 aviso pré-existente: test/setup.ts órfão)
turbo test        219 testes — domain 99, application 42, infrastructure 78
playwright        23/23, nenhum ignorado, contra Supabase local DE PÉ
next build        8 rotas
cobertura domínio 96,9% linhas · 98,8% ramos · 95,5% funções
git status nos caminhos do Flutter: vazio
```

A cobertura do domínio caiu de 98,94% para 96,9% porque o código sem chamador
foi removido junto com seus testes; segue bem acima do limiar de 90%.

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
  `descomissionamento-do-legado.md`; **2 atendidos, 8 pendentes** (CV-06 suíte
  verde e CV-09 extração, fechados em 2026-10-11 — ver
  [`legado-extracao.md`](./legado-extracao.md)).
  O caminho crítico é calendário, não código: CV-08 pede 4 semanas de uso real
  sem papel, e o relógio **começou a contar em 2026-10-24**, quando o PWA
  entrou em produção. Antes dessa data ele estava parado.
- `.avaliacao/` nunca vai para o git — fotos **e** saídas da sonda. Verificar com
  `git check-ignore -v .avaliacao/saida/deteccao.json`
- `spikes/fase0-deteccao/` é **código descartável**. Não importar nada dali em
  `packages/` ou `apps/`. Seu `.gitignore` exclui `modelos/` e `node_modules/`.
- `.reversa/reversa-config.json` está com `allowLegacyEdits: true` e
  `allowedPaths: []` — **liberação irrestrita**. Isso permite escrever em
  qualquer lugar; não significa que se deva.
