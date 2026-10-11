# Pendências abertas

Última revisão: 2026-10-11 · Commit: `56e00ce` · Branch: `main`

> **Registro único do que está em aberto.** Substitui as seções "próximo passo"
> das auditorias de 10-08, 10-09 e 10-11, que ficam como fotografia do dia em
> que foram escritas. Se um item sair daqui, saiu de verdade — atualize este
> arquivo na mesma passada em que fechar.

Nada abaixo bloqueia produção. O que bloqueia **evolução** é a seção
"Decisões que só o professor pode tomar": enquanto elas não vierem, duas
regras do domínio seguem apoiadas em premissa.

---

## Visão geral

| # | Pendência | Classe | Custo de fechar |
|---|---|---|---|
| 1 | PostCSS vulnerável | dívida | 2 linhas + lockfile |
| 2 | Guard do legado não dispara no CI | dívida | 1 bloco no gatilho |
| 3 | `redefinirContainer()` sem aviso sobre `parar()` | dívida | 1 comentário |
| 4 | Duração da carência de edição nunca confirmada | decisão | pergunta ao professor |
| 5 | Composição da escala infantil nunca confirmada | decisão | pergunta ao professor |
| 6 | Biometria travada em dados e licença | produto | pesquisa |
| 7 | Cinco áreas sem teste | cobertura | variável |
| 8 | Ambientes implantados nunca exercitados | risco | acesso |

---

## 1. PostCSS vulnerável

Herdado da auditoria de 10-09, item 15. Confirmado em 2026-10-11:

```
pnpm audit --prod → 4 vulnerabilidades (2 altas, 2 moderadas)
apps/web > next@15.5.27 > postcss@8.4.31     corrigido em >= 8.5.23
```

A exposição é principalmente de build: o repositório controla o CSS
processado. Correção mínima, no `package.json` da raiz:

```json
"pnpm": { "overrides": { "postcss": ">=8.5.23" } }
```

Confirmar com `pnpm audit --prod` e `pnpm build` — a sobreposição força uma
versão que o Next não escolheu, então o build é a prova de que nada quebrou.

**Se ignorarmos:** vulnerabilidade conhecida em dependência de produção, que
qualquer varredura aponta.

---

## 2. O guard do legado não dispara quando o legado muda

Herdado da auditoria de 10-08, item 19, **fechado pela metade**. A parte da
revisão base foi corrigida (hoje usa `github.event.pull_request.base.sha ||
github.event.before`); a parte do gatilho **não**.

Evidência em [`.github/workflows/web-ci.yml`](../.github/workflows/web-ci.yml):
o `paths:` lista `apps/**`, `packages/**`, `infra/**` e arquivos de raiz —
**nenhum caminho legado**. Um commit que toque apenas `lib/` ou `supabase/`
não dispara o workflow, então o passo *"O legado Flutter permanece intocado"*
nunca roda e a garantia que ele promete não existe nesse caso.

Correção mínima: acrescentar os caminhos vigiados ao gatilho de `push`.

```yaml
      - 'lib/**'
      - 'test/**'
      - 'supabase/**'
      - 'web/**'
      - 'windows/**'
      - 'pubspec.yaml'
```

Vale conferir também o caso em que `github.event.before` vem zerado (primeiro
push de uma branch, ou force-push): `BASE="${BASE:-HEAD^}"` **não** substitui
um SHA de zeros, porque ele não é vazio. Não testei esse caminho.

**Se ignorarmos:** o legado pode ser alterado sem que nada acuse — e a
regra não-negociável do projeto depende justamente desse passo.

> Episódio concreto: nesta sessão, `supabase start` escreveu
> `supabase/.temp/cli-latest`, **dentro do legado**, e o arquivo foi commitado
> sem que minha checagem local pegasse, porque ela rodou antes de o arquivo
> existir. Corrigido no `.gitignore` (`56e00ce`), mas a classe do problema
> continua: ferramenta que escreve em caminho legado depois da conferência.

---

## 3. `redefinirContainer()` traz o sincronizador zumbi de volta

`SincronizadorOutbox.parar()` só é chamado por `sair()`. Quem usar
[`redefinirContainer()`](../apps/web/src/composicao/container.ts) direto
descarta o container deixando a instância antiga **ainda inscrita** em
`observarFila`, que guarda os ouvintes num `Set` de módulo. Duas instâncias
passam a processar o mesmo outbox.

Foi exatamente o defeito que a revisão de segurança apontou em `sair()`, e que
o `afterEach` de `sincronizador.test.ts` teve de contornar no harness.

Correção mínima: um comentário em `redefinirContainer` dizendo que o chamador
precisa ter parado o sincronizador antes. Correção melhor, se alguém for mexer
ali: fazer `redefinirContainer()` chamar `parar()` na instância que está
descartando.

**Se ignorarmos:** o próximo caminho que descartar o container reintroduz a
corrida, e desta vez sem revisão olhando.

---

## 4 e 5. Decisões que só o professor pode tomar

As duas estão marcadas com ⚠️ no próprio código, para quem for mexer tropeçar
nelas.

### 4. Quanto tempo uma chamada confirmada continua editável

[`chamada.ts`](../packages/domain/src/chamada/chamada.ts) — `OQ-03` de
`chamada-e-presenca`. Premissa adotada: **24 horas** a contar da realização.
Nunca confirmada.

Se o professor disser outro número, é uma constante. Se ele disser "sempre" ou
"até o fim da aula", muda a regra e os testes de carência junto.

### 5. Como é a escala infantil, e onde fica o corte

[`faixa.ts`](../packages/domain/src/valor/faixa.ts) — premissa 2 do roadmap.
Adotado: corte aos **16 anos**; infantil = branca, cinza, amarela, laranja,
verde; adulta = branca, azul, roxa, marrom, preta; **graus não modelados**.

A composição varia entre federações. Corrigir custa dois lugares, e eles estão
amarrados de propósito: a constante em `faixa.ts` e a constraint
`aluno_faixa_coerente_com_escala` em
[`0003_aluno_turma_matricula.sql`](../infra/supabase/migrations/0003_aluno_turma_matricula.sql).
**Alterar um sem o outro quebra a sincronização**: o cliente aceita a faixa, o
servidor recusa com 400, o item vira falha permanente e o professor tem que
resolver na tela de Pendências.

**Se ignorarmos:** o sistema pode estar graduando pela escala errada desde o
primeiro aluno cadastrado.

---

## 6. Biometria: travada em dados e licença, não em código

A porta está declarada e **nenhuma implementação existe**, por decisão (D-13).
Detalhe em
[`fase0-deteccao-resultado.md`](../_reversa_forward/001-fundacao-e-chamada-manual/fase0-deteccao-resultado.md).

Estado: **detecção resolvida** (YuNet, MIT, 118/118 em 11 fotos). O risco
migrou para o reconhecimento, e ele tem dois bloqueios reais:

1. **Fotos sem recompressão.** As disponíveis passaram pelo WhatsApp, e o que
   limita o reconhecimento é o tamanho do rosto em pixel.
2. **Modelo de embedding com licença permissiva.** Todo o InsightFace, incluindo
   o `w600k_mbf`, é *non-commercial research only*. **Não serve.** A licença
   precisa ser critério de entrada na busca, não conferência final.

> Registro de calibragem que vale manter: **três previsões sobre a hostilidade
> desse dojo já foram desmentidas pela medição** — contraluz, espelho e
> ladrilhamento. Todas erraram no mesmo sentido, superestimando a dificuldade a
> partir de descrição textual. Antes da próxima estimativa, medir.

Fora de escopo da feature 001 e sem bloqueio nenhum: graduação, relatórios em
PDF e notificações.

---

## 7. O que não tem teste

| Área | Por que não tem | Como ficaria coberta |
|---|---|---|
| Cota de armazenamento esgotada | exigiria forjar `navigator.storage.estimate` | stub do `navigator.storage` num teste de unidade de `cota.ts` |
| Falha parcial entre gravar e enfileirar | a transação do Dexie é a garantia; não há como interrompê-la pela metade | nenhuma forma honesta conhecida |
| "Nenhum dado pessoal no log" | higienização por lista de campos em `log.ts`, sem teste | teste de unidade passando nome e data de nascimento e exigindo que sumam |
| RLS no Supabase **hospedado** | o E2E cobre o Supabase local | rodar o mesmo cenário contra o projeto real |
| Celular físico e volume real | nunca exercitados | — |

As três primeiras são baratas. A de log é a que mais vale: é uma promessa de
LGPD sustentada hoje só por uma lista de strings.

---

## 8. Riscos residuais conhecidos

- **Ambientes implantados nunca exercitados.** Supabase hospedado e Vercel. É
  o maior risco residual do projeto, e não mudou nesta sessão.
- **O bloqueio entre abas não espera, pula.** Quando uma aba está com a fila, a
  outra desiste da rodada. Se a aba A acabou de passar pelo item que a aba B
  reativou em Pendências, esse item só sobe no próximo gatilho — conexão,
  enfileiramento ou retentativa agendada. **Não trava, adia.**
- **`rotasDoApp()` lê o disco em tempo de build** para montar o pré-cache. Um
  build remoto sem `src/app` em disco quebra — ruidosamente, não em silêncio.
- **O stub de Web Locks em `test/setup.ts` implementa só `ifAvailable`.** É o
  único modo que o código usa; qualquer outro **lança** em vez de fingir que
  funcionou.

---

## O que NÃO está em aberto

Para ninguém reabrir o que já foi decidido ou fechado:

| Assunto | Estado |
|---|---|
| Itens 1–14 da auditoria de 10-08 | fechados (ver 10-09) |
| Itens 16 e 17 da auditoria de 10-09 | fechados em 2026-10-11 |
| Os 13 achados da auditoria de 10-11 | fechados, com teste |
| `BUG-20261009-NLLT` | fechado, `DONE.md` ao lado |
| Flutter em `lib/`, `web/`, `windows/` | **congelado de propósito**, não é dívida. A remoção tem critérios próprios em `_reversa_sdd/sdd/descomissionamento-do-legado.md` |
| Código removido por não ter chamador | decisão consciente; volta em 5 linhas quando a feature que o justifica chegar |
| `total_detectado` e `criada_offline` sempre nulos | ganchos declarados da biometria, mantidos de propósito |
