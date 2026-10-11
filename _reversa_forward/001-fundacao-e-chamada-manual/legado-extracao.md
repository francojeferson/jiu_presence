# Extração de informação do legado Flutter

> **Fecha o CV-09 de [`descomissionamento-do-legado.md`](../../_reversa_sdd/sdd/descomissionamento-do-legado.md)**,
> que depende do checklist RF-01 a RF-06 da §6.2 daquela spec.
>
> ⚠️ **Mora aqui, e não ao lado da spec, de propósito:** `_reversa_sdd/` está
> no `.gitignore`. Um arquivo cuja razão de existir é sobreviver à remoção do
> legado não pode ficar fora do histórico — seria preservar nada. Este
> diretório é versionado, e é onde a evidência do RF-02 já morava.
>
> Data: 2026-10-11 · Fonte: os 7 arquivos Dart de `lib/`, os 6 de `test/`, e
> `pubspec.yaml`, todos lidos na íntegra. Nada aqui foi inferido de documento
> anterior.
>
> **Este arquivo não autoriza remoção nenhuma.** Ele fecha um dos dez
> critérios; os outros nove continuam valendo.

## Situação do checklist

| | | Estado |
|---|---|---|
| **RF-01** | Textos de interface inventariados | ✅ fechado aqui, seção 1 |
| **RF-02** | `schema.sql` comparado com o novo | ✅ já estava, em [`data-delta.md`](./data-delta.md) e no cabeçalho das migrações `0001`/`0003` |
| **RF-03** | Modelos LGPD preservados fora da árvore | ✅ fechado em [`legado-lgpd-modelos.md`](./legado-lgpd-modelos.md) |
| **RF-04** | Decisões de modelagem registradas | 🟡 5 de 6, pela própria spec. A sexta nunca foi identificada |
| **RF-05** | Testes revisados por equivalência | ✅ fechado aqui, seção 2 |
| **RF-06** | Dependências mapeadas | ✅ fechado aqui, seção 3 |

---

## 1. Textos de interface (RF-01)

> Todos escritos em português pensando no professor, que é o motivo de a spec
> os considerar valor próprio. A coluna de destino diz o que aconteceu com
> cada um no PWA — **a maioria deixou de existir por mudança de escopo**, não
> por esquecimento.

### Login — `lib/screens/login_screen.dart`

| Texto | Papel | Destino no PWA |
|---|---|---|
| `JiuPresence - Login` | título | virou só `JiuPresence` |
| `Email` · `Senha` · `Entrar` | rótulos | mantidos, idênticos |
| `Cadastrar novo aluno` | botão secundário | **removido.** Operador único, conta provisionada à mão: não há cadastro aberto |
| `Email é obrigatório` | validação | **removido.** `required` + `type="email"` do navegador |
| `Email inválido` | validação | idem |
| `Senha é obrigatória` | validação | idem |
| `Senha deve ter pelo menos 6 caracteres` | validação | **removido.** Regra de senha é do Supabase, não da tela |
| `Usuário não encontrado` | erro | **fundido** em `Email ou senha incorretos.` |
| `Senha incorreta` | erro | idem — e de propósito: não distinguir qual campo errou é boa prática e evita o professor ficar adivinhando |
| `Erro de conexão. Verifique sua internet` | erro | virou `Não foi possível entrar. Verifique sua conexão e tente de novo.` |
| `Muitas tentativas. Tente novamente em alguns minutos` | erro | **sem equivalente.** Rate limit do Supabase cai na mensagem genérica |
| `Erro ao fazer login. Tente novamente` | erro genérico | equivalente mantido |

### Cadastro — `lib/screens/registration_screen.dart`

| Texto | Papel | Destino no PWA |
|---|---|---|
| `Cadastro de Aluno` | título | mantido |
| `Nome Completo` → `Nome é obrigatório` / `Nome deve ter pelo menos 3 caracteres` | campo | **parcial.** Existe `Informe o nome do aluno.` (`schemas.ts`). O mínimo de 3 caracteres sumiu |
| `Idade` → `Idade é obrigatória` / `Idade deve ser um número` / `Idade deve estar entre 1 e 120` | campo | **removido.** O modelo novo guarda data de nascimento e deriva a escala de faixa dela |
| `Peso` → `Peso é obrigatório` / `Peso deve ser um número` / `Peso deve estar entre 0.1 e 500 kg` | campo | **removido.** Peso não existe no modelo novo |
| `Altura` → `Altura é obrigatória` / `Altura deve ser um número` / `Altura deve estar entre 0.1 e 3.0 metros` | campo | **removido.** Idem |
| `Cor da Faixa` → `Cor da faixa é obrigatória` | campo | virou `Escolha a faixa atual.`, agora com lista fechada por escala em vez de texto livre |
| `Aluno menor de idade?` | interruptor | **removido.** Deriva-se da data de nascimento |
| `Nome do Responsável` → `Nome do responsável é obrigatório` / `... pelo menos 3 caracteres` | campo | **removido.** Responsável legal saiu com a LGPD do escopo |
| `CPF do Responsável` → `CPF do responsável é obrigatório` / `CPF do responsável inválido` | campo | **removido.** CPF saiu do modelo (RN-09): existia para o termo LGPD e para cobrança, ambos fora de escopo |
| `Li e concordo com o Termo de Consentimento LGPD` | aceite | **removido.** LGPD fora de escopo; risco R6 prevê reabertura |
| `Termo de Consentimento - LGPD` · `Fechar` | modal | idem — texto preservado em [`legado-lgpd-modelos.md`](./legado-lgpd-modelos.md) §3 |
| `Você deve aceitar os termos LGPD para continuar.` | recusa | idem |
| `Capturar Face` · `Cadastrar e Salvar Biometria` | biometria | **removido.** Porta declarada, sem implementação |
| `Você deve capturar a foto do rosto` | recusa | idem |
| `Você deve completar a captura facial` | recusa | idem |
| `Aluno cadastrado com sucesso!` | sucesso | equivalente mantido |
| `Já existe um aluno com estes dados` | erro | **conceito preservado**, hoje pelas restrições de unicidade do banco e pela classificação da fila |
| `Dados inválidos fornecidos` | erro | virou falha permanente na tela de Pendências |
| `Erro ao cadastrar aluno. Tente novamente` | erro genérico | equivalente mantido |

### Dashboard — `lib/screens/home_screen.dart`

| Texto | Papel | Destino no PWA |
|---|---|---|
| `Dashboard - Turma Atual` | título | virou a tela de Chamada |
| `Registrar Presença da Turma (Câmera)` | ação principal | **removido.** É a biometria |
| `Alunos Presentes Hoje` | seção | conceito mantido na chamada |
| `Nenhum aluno encontrado` | lista vazia | equivalente mantido |
| `Aluno sem nome` · `Faixa: Não informada` | reserva de valor ausente | **removido.** Nome é obrigatório e faixa tem lista fechada: o caso não existe mais |
| `Presença registrada com sucesso!` | sucesso | ⚠️ **mentira no legado.** A tela mostrava isso sem comparar embedding com nada — ver seção 4 |
| `Erro ao carregar alunos: $e` · `Erro ao registrar presença: $e` | erro | **removido de propósito.** Interpolar a exceção crua na tela é o que `src/lib/erros.ts` existe para impedir |
| `Gerar Relatório PDF` → `Gerando relatório PDF...` | ação | **removido.** Era um `TODO` que só mostrava a mensagem. Relatórios são outra spec |

### Captura facial — `lib/screens/face_capture_screen.dart`

| Texto | Papel | Destino no PWA |
|---|---|---|
| `Captura Biométrica` | título | **sem equivalente** — mas os três abaixo valem guardar para quando a biometria chegar |
| `Posicione o rosto no centro` | instrução | ⭐ reaproveitável |
| `Processando biometria...` | progresso | ⭐ reaproveitável |
| `Nenhum rosto detectado. Tente novamente.` | falha | ⭐ reaproveitável |
| `Erro ao capturar: $e` | erro | não reusar: expõe exceção crua |

### Aplicação — `lib/main.dart`

`Jiu Presence` como título da aplicação (hoje `JiuPresence`, sem espaço) e
tema `Material3` com semente `deepPurple`. O PWA não herdou a paleta.

---

## 2. Equivalência dos testes (RF-05)

> Os 6 arquivos de `test/` lidos na íntegra. A spec pede confirmar, para cada
> caso, se existe cobertura equivalente **ou** se o caso deixou de existir.

| Arquivo | Casos | Veredito |
|---|---|---|
| `validation_test.dart` | CPF válido/inválido, email vazio/inválido/válido, senha vazia/curta/válida | **Deixaram de existir.** CPF saiu do modelo; email e senha são validados pelo navegador e pelo Supabase, não por regex própria. Note que o teste **duplicava as funções** em vez de importá-las da tela: validava uma cópia, não o código de produção |
| `login_screen_test.dart` | 6 casos: três de validação, um de chamada ao serviço, um de erro amigável, um de carregando | Validação: deixou de existir. Chamada ao serviço e fluxo de entrada: cobertos pelo **e2e**. Indicador de carregando: coberto pelo estado `entrando` da tela |
| `login_screen_simple_test.dart` | 4 casos | **Duplicata** de `login_screen_test.dart`. Mesmos asserts, nomes diferentes |
| `login_screen_loading_test.dart` | 1 caso, carregando | **Terceira cópia** do mesmo cenário, agora com mock próprio |
| `registration_screen_test.dart` | 6 casos: aceite LGPD, nome vazio, idade inválida, CPF do responsável, foto ausente, cadastro válido | LGPD, idade, CPF e foto **deixaram de existir** com o escopo. Nome vazio: coberto por `schemas.ts` e pelo domínio. O caso "cadastro válido" **não provava nada**: o comentário admite que não conseguia injetar o mock, então afirmava sucesso sem verificar chamada alguma |
| `widget_test.dart` | 1 | `expect(true, isTrue)`. Placeholder declarado no próprio cabeçalho |

**Conclusão do RF-05:** nenhum caso de teste do legado perde cobertura com a
remoção. Dos 18 casos, 3 arquivos eram cópias do mesmo cenário de login, 1 era
placeholder, 2 testavam código duplicado em vez do de produção, e 1 afirmava
sucesso sem verificar nada. O resto morreu com o escopo.

---

## 3. Dependências do `pubspec.yaml` (RF-06)

| Dependência Flutter | Para quê | Substituto no PWA |
|---|---|---|
| `supabase_flutter ^2.12.0` | banco e auth | `@supabase/supabase-js`, atrás de `OperacoesRemotas` |
| `google_mlkit_face_detection 0.9.0` | detecção de rosto | **YuNet** (OpenCV Zoo, MIT, 227 KB), escolhido na Fase 0 — e é a troca que mais importa: o ML Kit do Google não roda em navegador |
| `tflite_flutter ^0.12.1` | inferência | **em aberto.** Seria ONNX Runtime Web ou TF.js; depende do modelo de embedding, que ainda não tem candidato com licença permissiva |
| `camera ^0.12.0` | câmera | `getUserMedia`, nativo. Nada a instalar |
| `image_picker ^1.2.1` | escolher foto | `<input type="file" accept="image/*">`, nativo |
| `path_provider ^2.1.5` | caminho de arquivo | **sem substituto, nem precisa.** No navegador o armazenamento é IndexedDB, via Dexie |
| `cpf_cnpj_validator ^2.0.0` | validar CPF | **sem substituto.** CPF saiu do modelo (RN-09) |
| `syncfusion_flutter_pdf ^32.2.9` | relatório PDF | **sem substituto.** Relatórios são outra spec, fora de escopo. ⚠️ Licença comercial — vale lembrar disso quando a spec de relatórios chegar |
| `firebase_core ^4.5.0` | base do Firebase | **sem substituto.** Nunca foi usado de fato |
| `firebase_messaging ^16.1.2` | notificação push | **sem substituto.** Notificações estão fora de escopo. No PWA sairia por Web Push, sem Firebase |
| `mocktail ^1.0.0` (dev) | mocks | Vitest, com duplos escritos à mão |
| `flutter_lints ^6.0.0` (dev) | lint | ESLint + `typescript-eslint` + `dependency-cruiser` |

Duas observações que sobrevivem à remoção: o legado arrastava **Firebase
inteiro sem usar**, e o PDF dependia de **biblioteca comercial** — decisão a
refazer conscientemente quando relatórios voltarem ao escopo.

---

## 4. O que a leitura revelou e não estava registrado

**1. O `FaceNetService` era falso, e o dashboard mentia por cima dele.**
A spec já registrava que ele retorna número aleatório. O que não estava
registrado é que `home_screen.dart` exibia **"Presença registrada com
sucesso!"** sem comparar o embedding com coisa alguma — os comentários no
código dizem `// Here you would implement face matching logic` e enumeram os
três passos que faltavam. **O legado nunca registrou uma presença.** Isso
reforça o EC-09: inviabilidade do ML no PWA não é motivo para preservar o
Flutter, porque não há o que preservar.

**2. O termo LGPD mostrado na tela difere do documento em `docs/`.**
Duas versões, e a curta era a que o usuário via. Ambas preservadas em
[`legado-lgpd-modelos.md`](./legado-lgpd-modelos.md), com as diferenças apontadas.

**3. As credenciais do Supabase eram marcadores.**
`main.dart` inicializa com `https://your-project-id.supabase.co` e
`your-anon-key`; `home_screen.dart` busca alunos de `'your-academia-id'`.
Confirma o NG-01: **não existe dado de produção a migrar**, e o app nunca
falou com backend nenhum.

**4. O `setTestState` público era contágio de teste em produção.**
Já diagnosticado em `investigation.md` como ausência de inversão de
dependência. O que a leitura acrescenta é que **o contorno não funcionava**:
o próprio `registration_screen_test.dart` admite em comentário que não
conseguia injetar o mock e por isso não verificava a chamada ao serviço. O
método público existia em produção para servir a um teste que não testava.
