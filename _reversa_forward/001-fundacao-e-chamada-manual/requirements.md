# Requirements: Fundação Arquitetural e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`
> Pasta da extração reversa: `_reversa_sdd/`
> Confidência: 🟢 CONFIRMADO, 🟡 INFERIDO, 🔴 LACUNA / DÚVIDA
>
> **Nota de contexto greenfield:** este é um projeto novo. As citações apontam para os artefatos do pipeline `/reversa-new` (`prd.md`, `personas.md`, `ideation.md`, `sdd/*.md`) no lugar dos artefatos de descoberta (`architecture.md`, `domain.md`, `inventory.md`, `code-analysis.md`), que não existem porque não houve extração de legado. O selo 🟢 aparece apenas em fatos verificados no código Flutter existente; tudo que vem das specs é 🟡 por definição.

## 1. Resumo executivo

Entrega o esqueleto funcional do JiuPresence: monorepo TypeScript com Arquitetura Limpa e DDD, PWA Next.js instalável e operante offline, autenticação do professor, cadastro de alunos e turmas, e a **chamada manual** completa, com fila de sincronização.

Resolve imediatamente a metade de custo do problema: substitui a folha de papel por uma marcação de presença que leva menos de 90 segundos e, ao contrário da folha, gera dado consolidável. Não inclui reconhecimento facial, que depende de um spike de validação ainda não executado.

O recorte é deliberado: entrega um produto utilizável e validável em aula real **antes** de assumir o maior risco do projeto, e sobrevive intacto caso esse risco se materialize.

## 2. Contexto a partir do legado

| Fonte | Trecho relevante | Confidência |
|---|---|---|
| `_reversa_sdd/sdd/fundacao-arquitetural.md#6.1` | RF-01 a RF-17: monorepo por camadas, regra de dependência verificada em CI, PWA offline, Supabase Auth, RLS por padrão, código em diretórios novos | 🟡 |
| `_reversa_sdd/sdd/gestao-de-alunos-e-turmas.md#6.1` | RF-01 a RF-15: Aluno e Turma como agregados, matrícula N-para-N, inativação em vez de exclusão, escala de faixa por idade | 🟡 |
| `_reversa_sdd/sdd/chamada-e-presenca.md#6.1` | RF-01, RF-06, RF-08, RF-10, RF-12, RF-13, RF-19: chamada manual, lista completa da turma, unicidade turma+data | 🟡 |
| `_reversa_sdd/sdd/chamada-e-presenca.md#13` | Decisão de rollout: entregar o caminho manual em produção e validado antes de ligar o reconhecimento | 🟡 |
| `_reversa_sdd/sdd/sincronizacao-offline-first.md#6.1` | RF-01 a RF-17: cache de leitura, outbox, idempotência, ordenação monotônica, detecção de cota | 🟡 |
| `_reversa_sdd/prd.md#6` | Restrições: Clean Architecture + DDD obrigatórios, Next.js/Vercel, Supabase+pgvector, Cloudflare R2+Images+CDN, LGPD fora de escopo | 🟡 |
| `_reversa_sdd/prd.md#8` | Riscos R3 (recaída para o papel), R5 (dispersão de infra), R7 (deleção de legado bloqueada) | 🟡 |
| `_reversa_sdd/personas.md#Persona 1` | Professor, operador único, intermediário em apps de consumo, zero tolerância a fricção no tatame | 🟡 |
| `_reversa_sdd/ideation.md#Notas` | Herança analisada: casca pronta, núcleo nunca construído nas duas tentativas anteriores | 🟡 |
| `supabase/schema.sql` (projeto Flutter) | Tabelas `academia`, `aluno` com `vector(128)`, `presenca` sem contexto de aula. Confere o diagnóstico de que a turma não existia no modelo | 🟢 |
| `lib/services/supabase_service.dart` (projeto Flutter) | Singleton instanciado diretamente nas telas, credenciais placeholder `your-project-id.supabase.co` | 🟢 |
| `.reversa/reversa-config.json` | `allowLegacyEdits: false`, `allowedPaths: []`. Nenhuma escrita fora das pastas do Reversa é permitida | 🟢 |

## 3. Personas e cenários de uso

| Persona | Objetivo | Cenário-chave |
|---|---|---|
| Professor | Registrar a presença da turma sem gastar tempo de aula | De pé no tatame, sem rede, abre o PWA instalado, marca os presentes na lista e confirma em menos de 90 segundos |
| Professor | Manter a base de alunos em dia | Fora do horário de aula, cadastra um aluno novo e o matricula nas turmas em que vai treinar |
| Professor | Ter confiança de que o dado não se perdeu | Vê um indicador de quantas chamadas aguardam envio e observa o contador zerar quando a rede volta |

## 4. Regras de negócio novas ou alteradas

1. **RN-01:** A presença pertence a uma **chamada**, que pertence a uma **turma** e a uma **data**. Não existe presença solta. 🟡
   - Origem no legado: `supabase/schema.sql` tinha `presenca(aluno_id, ...)` sem entidade de aula 🟢
   - Tipo: alterada. Sem a aula como entidade não é possível responder "quem faltou", apenas "quem veio".
2. **RN-02:** Uma turma tem no máximo uma chamada confirmada por data. 🟡
   - Tipo: nova. É a invariante que torna a sincronização idempotente de fato.
3. **RN-03:** Um aluno aparece no máximo uma vez em uma chamada. 🟡
   - Tipo: nova.
4. **RN-04:** Um aluno pode estar matriculado em várias turmas; a chamada opera sempre no recorte de uma turma. 🟡
   - Tipo: nova. Reduz o conjunto candidato do futuro matching facial e dá sentido operacional ao "quem faltou".
5. **RN-05:** Aluno com histórico de presença não pode ser excluído, apenas inativado. 🟡
   - Tipo: nova. O histórico é o ativo central do produto.
6. **RN-06:** A presença conta pela **data da aula**, nunca pela data de sincronização. 🟡
   - Tipo: nova. O dispositivo pode ficar dias offline.
7. **RN-07:** A escala de faixa (adulta ou infantil) é derivada da idade do aluno. Sem data de nascimento, o professor escolhe explicitamente. 🟡
   - Tipo: nova.
8. **RN-08:** Toda escrita passa pela fila de sincronização, inclusive quando há rede disponível. 🟡
   - Tipo: nova. Dois caminhos de escrita significam duas semânticas, e a segunda só seria exercida offline, justamente no cenário crítico.
9. **RN-09:** CPF deixa de ser coletado. 🟡
   - Origem no legado: `pubspec.yaml` declara `cpf_cnpj_validator`, usado na `RegistrationScreen` 🟢
   - Tipo: removida. Existia para o termo LGPD e para a cobrança; ambos saíram do escopo.

## 5. Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de aceite | Confidência |
|---|---|---|---|---|
| RF-01 | Monorepo com pacotes separados para domínio, aplicação, infraestrutura, contratos e app web | Must | Build de todos os pacotes conclui; cada pacote declara sua fronteira de exports | 🟡 |
| RF-02 | Pacote de domínio sem dependência de framework, HTTP, banco ou browser | Must | Testes do domínio executam em Node puro, sem mock de infraestrutura | 🟡 |
| RF-03 | Teste de arquitetura que falha o build quando uma camada importa de camada mais externa | Must | Importação proibida introduzida propositalmente faz o pipeline falhar | 🟡 |
| RF-04 | Composition root única que resolve portas em adaptadores | Must | Trocar o adaptador de persistência por um fake em teste não altera nenhum caso de uso | 🟡 |
| RF-05 | PWA instalável com manifesto e service worker | Must | Prompt de instalação aparece em navegador móvel; app abre em modo standalone | 🟡 |
| RF-06 | Shell da aplicação renderiza sem rede em menos de 2 segundos | Must | Em modo avião, o PWA instalado abre e renderiza a navegação, sem tela de erro | 🟡 |
| RF-07 | Autenticação por email e senha via Supabase Auth, com sessão persistente | Must | Login válido cria sessão; reiniciar o dispositivo não exige novo login | 🟡 |
| RF-08 | RLS habilitada em todas as tabelas, negando por padrão | Must | Consulta com chave anônima sem sessão retorna zero linhas em todas as tabelas | 🟡 |
| RF-09 | Migrações versionadas em diretório novo, fora de `supabase/` | Must | `supabase/schema.sql` do projeto Flutter permanece byte-a-byte intacto | 🟢 |
| RF-10 | Cadastro de aluno com nome, data de nascimento, faixa e data da última graduação | Must | Aluno cadastrado aparece na listagem com os campos corretos; nome e faixa são obrigatórios | 🟡 |
| RF-11 | Escala de faixa oferecida conforme a idade calculada | Must | Aluno de 10 anos recebe escala infantil; de 25, escala adulta. As escalas não se misturam | 🟡 |
| RF-12 | Cadastro de turma com nome, dias da semana e horário | Must | Turma criada aparece na seleção de chamada nos dias configurados | 🟡 |
| RF-13 | Matrícula e desmatrícula de aluno em múltiplas turmas | Must | Aluno em duas turmas aparece na chamada de ambas; desmatriculado em uma, permanece na outra | 🟡 |
| RF-14 | Inativação de aluno preservando o histórico | Must | Inativo some da chamada; histórico permanece consultável | 🟡 |
| RF-15 | Recusa de exclusão de aluno com histórico, com oferta de inativação | Must | Exclusão é recusada com explicação em português e alternativa na mesma tela | 🟡 |
| RF-16 | Chamada manual: seleção de turma e marcação direta na lista | Must | Caminho direto da turma à lista de marcação, sem passar pela câmera | 🟡 |
| RF-17 | Lista exibe todos os alunos matriculados, presentes e ausentes | Must | A ausência é visível na tela, não deduzida pelo professor | 🟡 |
| RF-18 | Um toque alterna o estado de presença de um aluno | Must | Tocar a linha marca; tocar de novo desmarca | 🟡 |
| RF-19 | Contagem de presentes e ausentes visível antes da confirmação | Must | O total é exibido e atualiza a cada marcação | 🟡 |
| RF-20 | Chamada confirmada é persistida localmente, mesmo sem rede | Must | Offline, confirmar grava localmente e enfileira, sem erro visível | 🟡 |
| RF-21 | Impedimento de duas chamadas confirmadas para a mesma turma e data | Must | Nova tentativa abre a chamada existente em edição, nunca cria duplicata | 🟡 |
| RF-22 | Cache local de turmas, alunos ativos e matrículas | Must | Offline, a chamada de turma já sincronizada exibe a lista completa em menos de 300 ms | 🟡 |
| RF-23 | Toda escrita passa pela fila, com chave de idempotência gerada no cliente | Must | Enviar o mesmo item duas vezes resulta em um único registro no servidor | 🟡 |
| RF-24 | Fila persistida, sobrevivendo a fechamento do app e reinício do dispositivo | Must | Reiniciar o dispositivo preserva integralmente a fila pendente | 🟡 |
| RF-25 | Processamento da fila em ordem de criação | Must | Aluno criado offline e presença dele registrada em seguida sincronizam na ordem correta | 🟡 |
| RF-26 | Sincronização automática ao detectar retorno de conectividade | Must | Religar a rede dispara o envio sem ação do professor | 🟡 |
| RF-27 | Espera exponencial entre tentativas de reenvio | Must | Falhas sucessivas aumentam o intervalo até um teto | 🟡 |
| RF-28 | Distinção entre falha transitória e permanente | Must | Erro de rede é retentado; violação de regra vai para a lista de falhas com motivo legível | 🟡 |
| RF-29 | Indicador permanente de conectividade e de itens pendentes | Must | Offline com fila não vazia, o indicador é visível em qualquer tela sem interação | 🟡 |
| RF-30 | Identificadores gerados no cliente para entidades criadas offline | Must | Aluno criado offline é imediatamente referenciável por uma presença local | 🟡 |
| RF-31 | Data de criação local distinta da data de sincronização | Must | Chamada feita offline sincroniza com a data da aula, nunca com a data do envio | 🟡 |
| RF-32 | Detecção de cota de armazenamento local esgotada | Must | Cota cheia alerta e impede nova escrita antes de perder dado | 🟡 |
| RF-33 | Fronteira de erro global com mensagem em português e ação de recuperação | Should | Exceção em qualquer tela produz tela legível, nunca stack trace | 🟡 |
| RF-34 | Busca de aluno por nome, insensível a acento e caixa | Should | Digitar parte do nome filtra a lista | 🟡 |
| RF-35 | Deploy automático em produção a partir do branch principal | Must | Push no principal produz build e deploy; build que falha não publica | 🟡 |
| RF-36 | Credenciais exclusivamente em variáveis de ambiente, com arquivo de exemplo | Must | Busca por URL de projeto ou chave de API no repositório não retorna ocorrências | 🟡 |
| RF-37 | Código novo exclusivamente em diretórios que não existiam antes | Must | Nenhuma modificação ou deleção em `lib/`, `test/`, `supabase/`, `docs/`, `web/`, `windows/`, `pubspec.yaml`, `analysis_options.yaml` | 🟢 |

## 6. Requisitos Não Funcionais

| Tipo | Requisito | Evidência ou justificativa | Confidência |
|---|---|---|---|
| Desempenho | Chamada manual completa em menos de 90 segundos para 20 alunos | `sdd/chamada-e-presenca.md#RNF-02`. Piso garantido, independente do ML | 🟡 |
| Desempenho | Cold start do PWA offline em menos de 2 segundos | `sdd/fundacao-arquitetural.md#RNF-01` | 🟡 |
| Desempenho | Leitura da turma a partir do cache em menos de 300 ms | `sdd/sincronizacao-offline-first.md#RNF-02`. Primeira operação da chamada | 🟡 |
| Desempenho | Bundle inicial de JavaScript abaixo de 250 KB comprimido | `sdd/fundacao-arquitetural.md#RNF-02` | 🟡 |
| Disponibilidade | Fluxo de chamada funciona 100% offline | `prd.md#4`, `personas.md`. A rede não alcança o tatame | 🟡 |
| Durabilidade | Nenhuma escrita confirmada é perdida, em nenhuma circunstância | `sdd/sincronizacao-offline-first.md#RNF-01`. Perder presença confirmada é a falha mais grave possível | 🟡 |
| Segurança | RLS ativa desde a primeira migração, negando por padrão | `sdd/fundacao-arquitetural.md#12`. Habilitar RLS em banco já populado é fonte conhecida de vazamento | 🟡 |
| Segurança | Nenhum segredo no código-fonte | `sdd/fundacao-arquitetural.md#RF-14`. O projeto Flutter tinha credenciais placeholder no código 🟢 | 🟡 |
| Qualidade | Cobertura de testes do pacote de domínio igual ou superior a 90% de linhas | `sdd/fundacao-arquitetural.md#RNF-04`. O domínio é puro, não há dificuldade de teste a alegar | 🟡 |
| Qualidade | Zero violações da regra de dependência em CI | `sdd/fundacao-arquitetural.md#G-02`. É a falha estrutural diagnosticada nas duas tentativas anteriores | 🟡 |
| Acessibilidade | Alvos de toque de no mínimo 48×48 px na tela de marcação | `sdd/chamada-e-presenca.md#RNF-05`. Uso de pé, com pressa, mãos possivelmente suadas | 🟡 |
| Observabilidade | Log estruturado básico; sem APM ou tracing distribuído | `sdd/fundacao-arquitetural.md#NG-05`. Operador único | 🟡 |
| Resiliência | Chamada em andamento sobrevive a troca de app, tela bloqueada e desligamento | `sdd/chamada-e-presenca.md#RNF-06`, EC-03 e EC-04. Interrupção é certa no contexto real | 🟡 |
| Operacional | Custo mensal de infraestrutura em R$ 0 nas camadas gratuitas | `prd.md#6`. Premissa a confirmar | 🔴 |

## 7. Critérios de Aceitação

```gherkin
Cenário: Chamada manual offline em menos de 90 segundos
  Dado que o professor tem o PWA instalado e a turma já sincronizada
  E que o dispositivo está sem conexão de rede
  Quando ele abre o app, seleciona a turma e marca os 20 alunos presentes
  Então a lista carrega do cache em menos de 300 ms
  E a contagem de presentes é exibida e atualizada a cada toque
  E confirmar a chamada conclui em menos de 90 segundos no total
  E a chamada é gravada localmente sem nenhuma mensagem de erro

Cenário: Sincronização automática ao voltar a rede
  Dado que existe uma chamada confirmada offline na fila
  Quando o dispositivo reencontra conexão
  Então a chamada é enviada ao Supabase sem ação do professor
  E a data registrada é a data da aula, não a data do envio
  E o indicador de pendências volta a zero

Cenário: Reenvio não duplica presença
  Dado que uma chamada foi enviada mas a confirmação se perdeu na rede
  Quando a fila reenvia o mesmo item
  Então o servidor mantém um único registro para aquela turma e data
  E nenhuma presença duplicada é criada

Cenário: Persistência da fila após reinício do dispositivo
  Dado que há três chamadas pendentes na fila
  Quando o professor fecha o app e reinicia o dispositivo
  Então ao reabrir o app as três chamadas continuam na fila
  E o indicador mostra três itens pendentes

Cenário: Tentativa de chamada duplicada
  Dado que já existe uma chamada confirmada para a turma na data de hoje
  Quando o professor inicia a chamada novamente para a mesma turma
  Então o sistema abre a chamada existente em modo de edição
  E informa que já havia registro
  E nenhuma segunda chamada é criada

Cenário: Exclusão de aluno com histórico
  Dado um aluno com presenças registradas
  Quando o professor tenta excluí-lo
  Então o sistema recusa a exclusão
  E explica o motivo em português
  E oferece a inativação na mesma tela

Cenário: Violação da regra de dependência quebra o build
  Dado o pacote de domínio compilando normalmente
  Quando uma importação do pacote de infraestrutura é adicionada ao domínio
  Então o teste de arquitetura falha
  E o pipeline de CI não publica

Cenário: Acesso sem sessão é negado
  Dado que nenhuma sessão autenticada está ativa
  Quando uma consulta é feita com a chave anônima a qualquer tabela
  Então zero linhas são retornadas

Cenário: Código legado permanece intacto
  Dado o repositório com o projeto Flutter na raiz
  Quando toda a implementação desta feature é concluída
  Então nenhum arquivo em lib/, test/, supabase/, docs/, web/ ou windows/ foi modificado ou removido
  E pubspec.yaml e analysis_options.yaml permanecem inalterados

Cenário: Cota de armazenamento esgotada
  Dado um dispositivo sem espaço livre para o armazenamento local
  Quando o professor tenta confirmar uma chamada
  Então o sistema alerta de forma bloqueante antes de aceitar a escrita
  E nenhum item da fila existente é descartado
```

## 8. Prioridade MoSCoW

| Item | MoSCoW | Justificativa |
|---|---|---|
| RF-01 a RF-04 (arquitetura e regra de dependência) | Must | É a falha estrutural diagnosticada nas duas tentativas anteriores. Sem verificação automática, a fronteira erode em semanas |
| RF-05, RF-06 (PWA offline) | Must | Sem offline o produto não funciona no tatame, que é o único lugar onde é usado |
| RF-07, RF-08 (auth e RLS) | Must | RLS habilitada depois, com banco populado, é fonte conhecida de vazamento |
| RF-09, RF-37 (isolamento do legado) | Must | Restrição de política vigente, não negociável pelo pipeline |
| RF-10 a RF-15 (alunos e turmas) | Must | Sem base de alunos não há chamada |
| RF-16 a RF-21 (chamada manual) | Must | É a entrega de valor desta feature |
| RF-22 a RF-32 (cache e fila) | Must | Offline não é camada que se adiciona depois; adicionar fila ao final exigiria reescrever todas as escritas |
| RF-35, RF-36 (deploy e segredos) | Must | Sem deploy não há validação em aula real, que é o critério de sucesso |
| RF-33 (fronteira de erro) | Should | Importante para a adoção, mas não bloqueia o fluxo principal |
| RF-34 (busca por nome) | Should | Ganha relevância acima de ~30 alunos por turma |
| RNF de desempenho da chamada (90s) | Must | É a métrica desta feature |
| RNF de cobertura de domínio (90%) | Should | Alvo de qualidade, não bloqueia entrega |
| RNF de custo zero | Could | Premissa não confirmada, ver lacuna |

## 9. Esclarecimentos

> Nenhuma sessão de dúvidas registrada ainda. Rode `/reversa-clarify` quando houver `[DÚVIDA]` pendente.
>
> **Nota do modo expresso:** o `/reversa-clarify` foi pulado por desenho do pipeline. As lacunas da seção 10 seguem para o `roadmap.md` como premissas 🟡, conforme previsto no `/reversa-plan`.

## 10. Lacunas

- 🔴 [DÚVIDA] **Nome do diretório raiz do app novo.** O Flutter ocupa a raiz e já usa `web/` e `test/`. Premissa adotada: monorepo com `apps/web` e `packages/*` na raiz, que não colidem com nada existente. Origem: `sdd/fundacao-arquitetural.md#OQ-04`, `sdd/descomissionamento-do-legado.md#OQ-02`.
- 🔴 [DÚVIDA] **Escala de faixas infantil e idade de corte.** A graduação infantil varia entre federações. Premissa adotada: corte aos 16 anos, escala infantil com as faixas cinza, amarela, laranja e verde, escala adulta com branca, azul, roxa, marrom e preta, sem graus nesta feature. Origem: `sdd/gestao-de-alunos-e-turmas.md#OQ-01` e `#OQ-02`.
- 🔴 [DÚVIDA] **Camada gratuita suficiente para o custo zero.** Não confirmado com os provedores. Premissa adotada: operador único cabe nos planos free de Vercel, Supabase e Cloudflare. Origem: `prd.md#6`.

## 11. Histórico de alterações

| Data | Alteração | Autor |
|---|---|---|
| 2026-10-04 | Versão inicial gerada por `/reversa-requirements` no modo expresso do `/reversa-new` | reversa |
