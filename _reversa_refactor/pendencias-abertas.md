# Pendências abertas

Última revisão: 2026-10-24 · Branch: `main`

> **Registro único do que está em aberto.** Substitui as seções "próximo passo"
> das auditorias de 10-08, 10-09 e 10-11, que ficam como fotografia do dia em
> que foram escritas. Se um item sair daqui, saiu de verdade — atualize este
> arquivo na mesma passada em que fechar.
>
> 🔑 Para retomar numa sessão nova: **`RETOMAR-JIUPRESENCE`**. O protocolo
> (ordem de leitura, estado esperado do Git, verificação antes de mexer) está
> em [`HANDOFF.md`](../_reversa_forward/001-fundacao-e-chamada-manual/HANDOFF.md).
> Este arquivo responde *o que* está aberto; o handoff responde *como* retomar.

**O sistema está em produção desde 2026-10-24**, com dado real dentro. Isso
muda a natureza das pendências 1 e 2: elas deixaram de ser "decisão adiada" e
viraram **custo crescente**. Enquanto eram premissa num banco vazio, corrigir
custava duas constantes; agora cada aluno cadastrado soma migração de dado ao
preço. Pergunte ao professor antes do próximo cadastro, não depois.

---

## Visão geral

| # | Pendência | Classe | Custo de fechar |
|---|---|---|---|
| 1 | Duração da carência de edição nunca confirmada | decisão | pergunta ao professor |
| 2 | Composição da escala infantil nunca confirmada | decisão | pergunta ao professor |
| 3 | Biometria travada em dados e licença | produto | pesquisa |
| 4 | Duas áreas sem teste | cobertura | variável |
| 5 | Produção nova, exercitada só no desktop | risco | aparelho e calendário |
| 6 | Política RLS larga demais para o futuro | segurança | migração |
| 7 | ~~`/favicon.ico` responde 404~~ | — | **fechado em 2026-10-24** |
| 8 | `zod` 3 sem versão corrigida | segurança | migração 3→4 |

> As três dívidas que ocupavam os lugares 1 a 3 foram fechadas em 2026-10-11 e
> estão em "O que NÃO está em aberto", no fim do arquivo. **Não sobrou nenhuma
> dívida de código em aberto:** o que resta depende de resposta do professor,
> de pesquisa, de aparelho na mão ou de uma migração deliberada.

---

## 1 e 2. Decisões que só o professor pode tomar

As duas estão marcadas com ⚠️ no próprio código, para quem for mexer tropeçar
nelas.

### 1. Quanto tempo uma chamada confirmada continua editável

[`chamada.ts`](../packages/domain/src/chamada/chamada.ts) — `OQ-03` de
`chamada-e-presenca`. Premissa adotada: **24 horas** a contar da realização.
Nunca confirmada.

Se o professor disser outro número, é uma constante. Se ele disser "sempre" ou
"até o fim da aula", muda a regra e os testes de carência junto.

### 2. Como é a escala infantil, e onde fica o corte

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

## 3. Biometria: travada em dados e licença, não em código

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

## 4. O que não tem teste

| Área | Por que não tem | Como ficaria coberta |
|---|---|---|
| Falha parcial entre gravar e enfileirar | a transação do Dexie é a garantia; não há como interrompê-la pela metade | nenhuma forma honesta conhecida |
| Celular físico e volume real | nunca exercitados | — |

> **A RLS no Supabase hospedado saiu desta lista em 2026-10-24**, verificada
> contra o projeto real. Ver "O que NÃO está em aberto".

**Nenhuma das duas restantes é barata, e nenhuma se fecha escrevendo teste.**
As duas que eram baratas foram fechadas em 2026-10-11 (`cota.test.ts` e
`log.test.ts`, +22 testes na infraestrutura). O que sobra depende de acesso a
ambiente ou de aparelho na mão, ou não tem forma honesta conhecida.

> Sobre a de log, que o registro chamava de "a que mais vale": ao escrever o
> teste descobriu-se que **o `log` tem um único chamador em todo o repositório**
> — `error.tsx`, que passa apenas `{ digest }`. Nunca houve vazamento para
> tapar; o teste é apólice contra o próximo chamador, não correção. O número
> que mudou de verdade é outro: a garantia **não** vem da lista de campos
> proibidos, e sim do filtro de TIPO, que descarta objetos e listas inteiros —
> por isso nenhum nome de campo não previsto vaza. As duas propriedades foram
> conferidas por verificação negativa: desligada a lista, 2 testes falham;
> desligado o filtro de tipo, falha o que importa.

---

## 5. Riscos residuais conhecidos

- **Produção exercitada só no desktop.** Supabase hospedado e Vercel deixaram
  de ser teoria em 2026-10-24: login, cadastro de aluno e turma, chamada e
  sincronização rodaram ponta a ponta contra o projeto real. O que **não** foi
  exercitado é celular físico, rede ruim de academia e volume de turma inteira.
  Era o maior risco residual do projeto; hoje é o segundo.
- **O relógio do CV-08 começou a contar em 2026-10-24.** O critério de
  descomissionamento do Flutter pede 4 semanas de uso real sem papel, e ele
  não podia começar antes do PWA estar em produção. Agora pode. Nada a fazer
  além de usar o sistema e marcar a data.
- **O bloqueio entre abas não espera, pula.** Quando uma aba está com a fila, a
  outra desiste da rodada. Se a aba A acabou de passar pelo item que a aba B
  reativou em Pendências, esse item só sobe no próximo gatilho — conexão,
  enfileiramento ou retentativa agendada. **Não trava, adia.**
- **`rotasDoApp()` lê o disco em tempo de build** para montar o pré-cache. Um
  build remoto sem `src/app` em disco quebra — ruidosamente, não em silêncio.
- **O stub de Web Locks em `test/setup.ts` implementa só `ifAvailable`.** É o
  único modo que o código usa; qualquer outro **lança** em vez de fingir que
  funcionou.
- **O log não enxerga dado pessoal embutido em texto.** O filtro age por nome
  de campo e por tipo, então `{ mensagem: 'duplicate key ... Ana Silva' }`
  passa inteiro. Hoje é teórico — o único chamador passa um `digest` — mas é o
  caminho por onde um erro do Supabase ecoando a linha recusada entraria no
  log. Está dito no cabeçalho de `log.test.ts`, para quem for logar `error`.

---

## 6. A política RLS é estreita hoje e larga amanhã

As seis políticas de `public` são, todas, a mesma expressão, escrita pela
migração [`0005`](../infra/supabase/migrations/0005_restringir_acesso_ao_operador.sql):

```sql
EXISTS (SELECT 1 FROM operador WHERE operador.id = auth.uid())
```

Isso **não** é "qualquer autenticado lê tudo" — essa leitura está no texto das
migrações `0002` e `0003`, que a `0005` reescreveu. Quem ler só as duas
primeiras vai concluir errado, como já aconteceu nesta sessão.

O que de fato está aberto é mais sutil: a política pergunta "existe *alguma*
linha em `operador` com este id", e não "este registro pertence a este
operador". Com um operador único isso é idêntico. **No dia em que existir um
segundo operador, ele enxerga os alunos do primeiro.** O PRD decidiu operador
único e sem multi-tenant, então hoje não é bug — é um
limite que precisa estar escrito antes de alguém adicionar o segundo login.

**Se ignorarmos:** a primeira academia parceira enxerga os alunos da segunda.

## 8. `zod` 3 não tem versão corrigida

`GHSA-mrhx-c7xc-m3w5` — exaustão de memória validando entrada gigante.
**Versões corrigidas começam em `4.6.6`; a última estável do 3.x é a
`3.25.76`, que é a que usamos.** Depois dela só existem canaries. Não há bump
que resolva: fechar exige migrar [`packages/contracts`](../packages/contracts/)
de zod 3 para 4, que é mudança de API.

**Por que não foi feito junto com os outros dois:** migração de major não entra
no mesmo commit que uma correção de RCE em produção. São riscos de natureza
diferente e merecem verificação separada.

**Por que não é urgente:** os schemas do contracts validam exatamente duas
coisas — o payload da própria outbox (gerado pelo app) e o cache vindo do
Supabase do próprio professor. Nenhuma entrada de terceiro alcança esses
schemas. Um DoS aqui seria autoinfligido, na aba do próprio professor.

O override `zod@4: ">=4.6.6"` na raiz já cobre o zod 4 que vem do
`@serwist/next`, que era o outro caminho e é ferramenta de build.

---

## O que NÃO está em aberto

Para ninguém reabrir o que já foi decidido ou fechado:

| Assunto | Estado |
|---|---|
| RCE não autenticado no Next (`GHSA-2464-fhr4-w9xw`, crítico) | **fechado em 2026-10-24**: `next` 15.5.27 → **15.5.28**. Só o lockfile estava velho, a faixa `^15.0.0` já permitia. Descoberto porque esta sessão rodou `pnpm audit --prod` de verdade em vez de confiar no "nenhuma vulnerabilidade" anotado em 10-11 — o aviso foi publicado depois daquela data, com o app já no ar |
| DoS no App Router do Next (`GHSA-p3m5-59mp-jv5r`, alta) | **fechado em 2026-10-24**, mesmo bump |
| `zod` 4 vulnerável via `@serwist/next` | **fechado em 2026-10-24**: override `"zod@4": ">=4.6.6"` na raiz, resolvido para 4.6.7. O override é restrito ao major 4 de propósito — arrastar o zod 3 do contracts junto seria mudança de API disfarçada de correção |
| `/favicon.ico` 404 | **fechado em 2026-10-24**: `apps/web/src/app/favicon.ico`, convenção do App Router. Gerado envolvendo o `icone-192.png` existente num contêiner ICO, sem dependência nova. Confirmado em `.next/server/app/favicon.ico` após build |
| Ambientes implantados nunca exercitados | **fechado em 2026-10-24.** Supabase `sa-east-1` e Vercel em produção, fluxo completo exercitado. Detalhes operacionais no [HANDOFF](../_reversa_forward/001-fundacao-e-chamada-manual/HANDOFF.md#produção) |
| RLS no Supabase hospedado | **fechado em 2026-10-24**, com verificação negativa de verdade: linha plantada como `postgres` e consultada como `anon`. Tabela vazia devolve `[]` com ou sem RLS, então o teste só vale com dado plantado. Leitura anônima 0 linhas, `INSERT` anônimo 401, e o `DELETE` anônimo volta **204 sem apagar nada** — confiar no status HTTP teria dado veredito errado |
| Cadastro aberto no Supabase Auth | **fechado em 2026-10-24**: `disable_signup: true`, provado tentando o cadastro com a chave pública (`422 signup_disabled`). Vinha ligado por padrão no projeto novo, e o produto não tem cadastro aberto por desenho |
| Site URL do Auth apontando para `localhost` | **fechado em 2026-10-24**: aponta para `https://jiu-presence.vercel.app`. Com o valor antigo, link de "esqueci minha senha" levaria o professor a localhost |
| PostCSS vulnerável | fechado em 2026-10-11: `overrides: { postcss: ">=8.5.23" }` na raiz. `pnpm audit --prod` saiu de 4 vulnerabilidades para **nenhuma**, e `pnpm build` segue verde com 8 rotas — a prova de que forçar versão que o Next não escolheu não quebrou nada |
| Gatilho do CI cego ao legado | fechado em 2026-10-11: o `paths:` de `push` espelha a lista `ALVOS` do passo que vigia o legado, e um `before` com SHA de zeros (primeiro push, force-push) agora cai em `HEAD^` por verificação explícita, não por `${BASE:-}` |
| `redefinirContainer()` sem `parar()` | fechado em 2026-10-11: a própria função desliga sincronizador e monitor antes de soltar a instância. `sair()` continua chamando os dois na ordem que precisa — ambos os `parar()` são idempotentes |
| Itens 1–14 da auditoria de 10-08 | fechados (ver 10-09) |
| Itens 16 e 17 da auditoria de 10-09 | fechados em 2026-10-11 |
| Os 13 achados da auditoria de 10-11 | fechados, com teste |
| `BUG-20261009-NLLT` | fechado, `DONE.md` ao lado |
| Flutter em `lib/`, `web/`, `windows/` | **congelado de propósito**, não é dívida. A remoção tem critérios próprios em `_reversa_sdd/sdd/descomissionamento-do-legado.md`: **2 de 10 atendidos**. A extração de informação (CV-09) foi fechada em 2026-10-11 em [`legado-extracao.md`](../_reversa_forward/001-fundacao-e-chamada-manual/legado-extracao.md), então nada de valor se perde na remoção. Os 8 restantes dependem de produção, de aulas reais e de 4 semanas de calendário — **nenhum se fecha escrevendo código** |
| Código removido por não ter chamador | decisão consciente; volta em 5 linhas quando a feature que o justifica chegar |
| `total_detectado` e `criada_offline` sempre nulos | ganchos declarados da biometria, mantidos de propósito |
