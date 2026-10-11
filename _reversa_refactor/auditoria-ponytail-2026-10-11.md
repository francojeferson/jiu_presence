# Auditoria do repositório e handoff de sessão

Data da auditoria: 2026-10-11
Branch: `auditoria/correcoes-e-cobertura`
Commit auditado: `270cb02` (ponto de partida, `main`)
Modo: Ponytail ultra — auditoria somente leitura, seguida de correção na mesma sessão

> **Palavra-chave de retomada: `RETOMAR-POSTCSS`**
>
> Continua a mesma da sessão anterior: o item 15 nunca foi tocado.

---

## Em uma frase

Treze achados na auditoria, mais três corridas de concorrência descobertas ao
escrever os testes, **todos corrigidos e verificados**. A cobertura de ponta a
ponta foi de 8 cenários (1 ignorado) para 23 (nenhum ignorado), rodando contra
o Supabase local. Restam os itens 15 e 16 da auditoria anterior — e o 16 foi
fechado nesta sessão.

## Estado verificado ao fim da sessão

Tudo abaixo foi executado, não presumido:

```
turbo typecheck   14 tarefas
turbo test        219 testes — domain 99, application 42, infrastructure 78
cobertura domínio 96,9% linhas · 98,8% ramos · 95,5% funções (mínimos 90/85/90)
depcruise         0 erros (1 aviso pré-existente: test/setup.ts órfão)
turbo build       8 rotas
playwright        23 passaram, 0 ignorados, contra Supabase local
guard do legado   simulado localmente: "Legado intocado."
```

O Supabase local foi iniciado de verdade nesta sessão (Docker Desktop +
`supabase start --workdir infra`), e parado ao final.

---

## O que foi corrigido

Numeração desta auditoria. Commits na branch `auditoria/correcoes-e-cobertura`.

| # | Achado | Commit |
|---|---|---|
| 1 | FK transitória eterna travava a fila inteira, em silêncio | `0b7dfd8` |
| 2 | Cadastro de aluno com data que não sugere escala ficava sem saída | `0b7dfd8` |
| 3 | `escrever()` gravava `versaoSchema: 1` fixo | `0b7dfd8` |
| 4 | Inativar aluno não tinha volta | `0b7dfd8` |
| 5 | `puxar()` não paginava aluno, turma e matrícula | `0b7dfd8` |
| 6 | Trocar de turma descartava marcações sem avisar | `0b7dfd8` |
| 7 | Nenhuma saída da conta; dado pessoal ficava no aparelho | `0b7dfd8` |
| 8 | `LIMITE_DE_PENDENCIAS_PARA_ALERTA` era constante morta | `0b7dfd8` |
| 9 | ~200 linhas sem chamador | `0b7dfd8` |
| 10 | Automação do quadrinho Explosm (= item **17** da auditoria de 10-09) | `0143586` |
| 11 | `garantirEditavel` ignorava o relógio injetado | `0b7dfd8` |
| 12 | `higienizar` rodava duas vezes por log | `0b7dfd8` |
| 13 | Desativar turma não tinha volta (achado tardio, não estava no relatório) | `0b7dfd8` |
| — | **Pré-cache sem nenhum documento HTML** (descoberto ao escrever o E2E) | `8b78d09` |
| — | Sincronizador zumbi + ordem de `sair()` + sessão offline | `8b766c9` |
| — | Recusa de saída com fila cheia não era atômica | `7fb3bf5` |
| — | Duas abas enviavam o mesmo item duas vezes (EC-08) | `c02e9ce` |

### O mais grave: a fila que parava em silêncio

Uma violação de chave estrangeira era **sempre** transitória. Quando a
dependência ia para falha permanente ela nunca subia, o item retentava para
sempre e, como `prontos()` corta a fila no primeiro item em espera, **nada atrás
dele voltava a ser enviado**. A tela só dizia "aguardando envio", idêntico a
estar offline. O professor continuava dando aula achando que estava tudo salvo.

Agora, esgotada a escala de esperas, o item vai para Pendências — visível e
acionável, nunca descartado em silêncio.

### O mais surpreendente: o PWA abria offline por acidente

O manifesto gerado pelo Serwist tinha 31 entradas e **zero documentos HTML**.
Offline, só abria a página que o professor por acaso já tinha carregado online,
via o cache de runtime do `defaultCache`. E a página `/offline` não podia ser
servida, porque o próprio fallback não estava em cache: o que aparecia era o
erro de rede do navegador, que é o cenário do risco R3.

A lista de rotas agora é **lida do disco** em `next.config.ts`, não escrita à
mão: lista manual envelhece em silêncio e a rota esquecida só se manifesta no
tatame, sem rede, meses depois.

---

## Três revisões de segurança seguidas no mesmo arquivo

`apps/web/src/composicao/container.ts` foi apontado três vezes pela revisão
automática de commit. **Todas as três procediam.** Vale registrar o padrão,
porque é um erro de categoria, não de digitação:

1. **Sincronizador zumbi.** `observarFila` guarda os ouvintes num `Set` de
   módulo, que sobrevive ao descarte do container. Enquanto não havia saída da
   conta isso era inofensivo.
2. **Ordem errada.** Apagar o cache depois de encerrar a sessão deixava estado
   inconsistente se a limpeza falhasse.
3. **Guarda na tela, não na operação.** A recusa com fila cheia morava em
   `turmas/page.tsx`, sem atomicidade com a limpeza.

O padrão: **eu tratei a tela como responsável por invariantes de dado.** As três
correções foram empurrando a responsabilidade para onde o dado vive. Hoje
`limparCacheComFilaVazia()` confere e apaga na mesma transação do Dexie.

Um comentário meu estava **factualmente errado**: afirmava que o supabase-js
apaga a sessão local mesmo quando a chamada ao servidor falha. Offline, o escopo
padrão devolve erro. Há agora um `scope: 'local'` de fallback.

---

## Correções que o teste provou antes de existirem

Toda correção não trivial foi verificada **nos dois sentidos**: o teste fica
vermelho quando a correção é desfeita. Comprovado por remoção temporária em:

- pré-cache das páginas (`ERR_FAILED` ao abrir rota nunca visitada);
- guarda atômica da saída (2 testes de unidade falham);
- corrida de duas abas na saída (E2E falha);
- sessão após a saída (`toHaveURL` falha);
- FK que nunca chega (teste de classificação e do sincronizador).

A corrida de duas abas **enviando o mesmo item** foi medida antes da correção:
`expected 2 to be 1`.

---

## Armadilhas de teste encontradas (leia antes de escrever E2E aqui)

Custaram tempo e vão custar de novo se ninguém registrar:

1. **Duas abas são duas `Page` no mesmo `BrowserContext`.** Dois
   `BrowserContext` **não** compartilham IndexedDB; duas abas sim. Eu afirmei o
   contrário e estava errado — `context.newPage()` resolve.
2. **`autenticar()` injeta a sessão por `addInitScript`, que roda de novo a cada
   carga de documento.** Offline, a ida para `/entrar` é carga de documento,
   porque o roteador do Next não alcança o payload da rota. Qualquer asserção
   sobre a sessão ter sido apagada precisa de **login de verdade**.
3. **Payload semeado na fila precisa ser válido.** Um payload truncado é
   recusado pela validação local antes de qualquer rede, e o teste vira outra
   coisa — "corrupção local" em vez do que se queria medir.
4. **`observarFila` vaza ouvintes entre testes.** O sincronizador de um teste
   continua reagindo à fila do seguinte. Há `afterEach` chamando `parar()` em
   `sincronizador.test.ts`; mantenha.
5. **Node não tem Web Locks.** `test/setup.ts` instala um stub mínimo, só com
   `ifAvailable`. Sem ele, a exclusão entre abas fica sem teste.

---

## Próximo passo recomendado

### Item 15 da auditoria de 10-09: PostCSS vulnerável — **ainda aberto**

Confirmado nesta sessão:

```
pnpm audit --prod → 4 vulnerabilidades (2 altas, 2 moderadas)
apps/web > next@15.5.27 > postcss@8.4.31   (corrigido em >= 8.5.23)
```

Correção mínima: adicionar ao `package.json` da raiz

```json
"pnpm": { "overrides": { "postcss": ">=8.5.23" } }
```

e confirmar com `pnpm audit --prod` e `pnpm build`. Não fiz nesta sessão porque
o pedido era documentar, e um bump de dependência exige lockfile novo e build
verificado — é mudança de código, não de registro.

### Item 16 da auditoria de 10-09: README enganoso — **fechado nesta sessão**

A PWA passou a ser o ponto de entrada e o Flutter ganhou seção explícita de
legado, com o aviso de não usar `supabase_service.dart` como referência.

### Item 17 — **fechado nesta sessão**

Workflow, scraper, imagem e o código morto que o item citava.

### Depois disso

Nada do que sobrou bloqueia produção. A escolha é entre:

- **Retomar a biometria.** Continua travada em obter fotos sem recompressão e
  escolher um modelo com licença permissiva. Ver
  `_reversa_forward/001-fundacao-e-chamada-manual/fase0-deteccao-resultado.md`.
- **Ampliar a cobertura** nos pontos que seguem sem teste (abaixo).

---

## O que continua sem cobertura

| Área | Por quê |
|---|---|
| Cota de armazenamento esgotada (`ErroDeCotaEsgotada`) | exigiria forjar `navigator.storage.estimate`; o caminho é curto o bastante para ler |
| Gravação local + enfileiramento em falha parcial | a transação do Dexie é a garantia; não há como interrompê-la pela metade |
| "Nenhum dado pessoal no log" | higienização por lista de campos, sem teste |
| RLS no painel do Supabase hospedado | o E2E cobre o Supabase local, não o ambiente real |
| Celular físico e volume real | nunca exercitados |

---

## Risco residual

- **`parar()` só é chamado por `sair()`.** Quem usar `redefinirContainer()`
  direto traz o sincronizador zumbi de volta. Não há comentário avisando no
  `redefinirContainer`.
- **Bloqueio entre abas não espera.** Quando uma aba está com a fila, a outra
  pula a rodada. Se a aba A acabou de passar pelo item que a aba B reativou em
  Pendências, esse item só sobe no próximo gatilho. Não trava, adia.
- **`rotasDoApp()` lê o disco em tempo de build.** Build remoto sem `src/app`
  em disco quebra — ruidosamente, não em silêncio.
- **Ambientes implantados** (Supabase hospedado, Vercel) seguem sem verificação.

## Veredito

A fila de sincronização, que é onde o dado do professor pode se perder, está
materialmente mais segura do que no início da sessão: o caminho que a congelava
em silêncio foi fechado, a saída da conta não consegue mais abandonar registro
no aparelho, e duas abas não disputam mais a mesma fila. O que resta é
dependência vulnerável e ambiente real nunca exercitado.
