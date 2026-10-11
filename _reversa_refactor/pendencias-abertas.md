# Pendências abertas

Última revisão: 2026-10-11 · Branch: `main`

> **Registro único do que está em aberto.** Substitui as seções "próximo passo"
> das auditorias de 10-08, 10-09 e 10-11, que ficam como fotografia do dia em
> que foram escritas. Se um item sair daqui, saiu de verdade — atualize este
> arquivo na mesma passada em que fechar.
>
> 🔑 Para retomar numa sessão nova: **`RETOMAR-JIUPRESENCE`**. O protocolo
> (ordem de leitura, estado esperado do Git, verificação antes de mexer) está
> em [`HANDOFF.md`](../_reversa_forward/001-fundacao-e-chamada-manual/HANDOFF.md).
> Este arquivo responde *o que* está aberto; o handoff responde *como* retomar.

Nada abaixo bloqueia produção. O que bloqueia **evolução** é a seção
"Decisões que só o professor pode tomar": enquanto elas não vierem, duas
regras do domínio seguem apoiadas em premissa.

---

## Visão geral

| # | Pendência | Classe | Custo de fechar |
|---|---|---|---|
| 1 | Duração da carência de edição nunca confirmada | decisão | pergunta ao professor |
| 2 | Composição da escala infantil nunca confirmada | decisão | pergunta ao professor |
| 3 | Biometria travada em dados e licença | produto | pesquisa |
| 4 | Cinco áreas sem teste | cobertura | variável |
| 5 | Ambientes implantados nunca exercitados | risco | acesso |

> As três dívidas que ocupavam os lugares 1 a 3 foram fechadas em 2026-10-11 e
> estão em "O que NÃO está em aberto", no fim do arquivo. **Não sobrou nenhuma
> dívida de código em aberto:** o que resta depende de resposta do professor,
> de pesquisa ou de acesso a ambiente.

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
| RLS no Supabase **hospedado** | o E2E cobre o Supabase local | rodar o mesmo cenário contra o projeto real |
| Celular físico e volume real | nunca exercitados | — |

**Nenhuma das três restantes é barata, e nenhuma se fecha escrevendo teste.**
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
- **O log não enxerga dado pessoal embutido em texto.** O filtro age por nome
  de campo e por tipo, então `{ mensagem: 'duplicate key ... Ana Silva' }`
  passa inteiro. Hoje é teórico — o único chamador passa um `digest` — mas é o
  caminho por onde um erro do Supabase ecoando a linha recusada entraria no
  log. Está dito no cabeçalho de `log.test.ts`, para quem for logar `error`.

---

## O que NÃO está em aberto

Para ninguém reabrir o que já foi decidido ou fechado:

| Assunto | Estado |
|---|---|
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
