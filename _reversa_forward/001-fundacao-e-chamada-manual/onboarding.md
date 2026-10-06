# Onboarding: Fundação e Chamada Manual

> Identificador: `001-fundacao-e-chamada-manual`
> Data: `2026-10-04`
> Público: quem vai rodar e testar esta feature pela primeira vez.

## 0. Antes de tudo: o que este repositório contém

Duas implementações do mesmo produto convivem aqui.

| Caminho | O que é | Status |
|---|---|---|
| `lib/`, `test/`, `supabase/`, `docs/`, `web/`, `windows/`, `pubspec.yaml` | Projeto Flutter anterior | 🟢 **Legado. Não tocar.** Bloqueado por `.reversa/reversa-config.json` |
| `apps/`, `packages/`, `infra/` | PWA novo, desta feature | Ativo |
| `_reversa_sdd/`, `_reversa_forward/` | Documentação do pipeline Reversa | Ativo |

⚠️ **O projeto Flutter permanece intocado.** `allowLegacyEdits` está em `false`. Não execute `flutter` nada, não edite `pubspec.yaml`, não apague `lib/`. A remoção é uma feature futura com critérios próprios, descritos em `_reversa_sdd/sdd/descomissionamento-do-legado.md`.

## 1. Pré-requisitos

| Item | Versão | Como verificar |
|---|---|---|
| Node.js | 20 LTS ou superior | `node --version` |
| pnpm | 9 ou superior | `pnpm --version` |
| Conta Supabase | projeto em região brasileira | acesso ao painel |
| Conta Vercel | qualquer plano | acesso ao painel |
| Navegador | Chrome ou Edge recente, para testar PWA e service worker | — |
| Dispositivo móvel real | Android ou iOS | necessário para validar offline de verdade |

🟡 Cloudflare não é necessário nesta feature (D-15). Entra na feature de biometria.

## 2. Configuração do backend

1. Crie um projeto no Supabase, escolhendo a região **South America (São Paulo)**.
2. Anote a URL do projeto, a chave anônima e a chave de serviço.
3. Aplique as migrações de `infra/supabase/migrations/`, em ordem numérica.
4. Confirme que a RLS está ativa:
   - No painel, abra cada tabela e verifique o indicador de RLS habilitada.
   - Teste a negação: uma consulta com a chave anônima e sem sessão deve retornar zero linhas em **todas** as tabelas.
5. Crie o usuário do professor manualmente em Authentication. Não há cadastro aberto.
6. Insira a linha correspondente em `operador`, usando o mesmo `id` do usuário criado.

## 3. Configuração local

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Preencha `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-chave-anonima>
```

⚠️ Nunca comite `.env.local`. Nenhuma credencial vai para o código-fonte (RF-36). O projeto Flutter tinha credenciais placeholder dentro de `lib/services/supabase_service.dart` 🟢 — este projeto não repete isso.

```bash
pnpm dev
```

Acesse `http://localhost:3000`.

## 4. Verificação da arquitetura

```bash
pnpm test
```

Deve executar, entre outros, o teste de regra de dependência. Para confirmar que ele realmente funciona, faça a verificação negativa:

1. Adicione em qualquer arquivo de `packages/domain` uma importação de `packages/infrastructure`.
2. Rode `pnpm test` novamente.
3. **O teste precisa falhar.** Se passar, a verificação não está ativa e o problema estrutural das tentativas anteriores foi reintroduzido.
4. Remova a importação.

## 5. Roteiro de teste funcional

### 5.1 Autenticação

1. Acesse a aplicação e entre com o email e a senha do professor.
2. Confirme que a sessão persiste: feche a aba, reabra, e você continua autenticado.
3. Teste a credencial errada: a mensagem deve estar em português e não expor código de erro técnico.

### 5.2 Cadastro

1. Crie uma turma: nome, dias da semana, horário.
2. Crie um aluno **adulto** com data de nascimento: confirme que as faixas oferecidas são da escala adulta.
3. Crie um aluno **criança** (menos de 16 anos): confirme que as faixas oferecidas são da escala infantil.
4. Crie um aluno **sem data de nascimento**: confirme que o sistema pede a escala explicitamente, em vez de presumir adulto.
5. Matricule os três na turma.
6. Tente excluir um aluno sem histórico: deve funcionar.

### 5.3 Chamada manual com rede

1. Abra a chamada e confirme que a turma do horário atual vem pré-selecionada.
2. Confirme que a lista mostra **todos** os alunos matriculados, presentes e ausentes.
3. Marque alguns com um toque; desmarque com outro.
4. Observe a contagem de presentes atualizando.
5. Confirme a chamada.
6. Tente abrir a chamada da mesma turma no mesmo dia: deve abrir a existente em modo de edição, nunca criar uma segunda.
7. Tente excluir um aluno que agora tem presença: deve ser recusado, com explicação e oferta de inativação.

### 5.4 Chamada offline — o teste que importa

Este é o cenário crítico da feature. Execute em **dispositivo real**, não no simulador do navegador.

1. Com rede, abra a aplicação e deixe a turma sincronizar.
2. Instale o PWA na tela inicial.
3. **Ative o modo avião.**
4. Feche o app completamente.
5. Abra pelo ícone na tela inicial. O shell deve renderizar em menos de 2 segundos, sem erro de rede.
6. Abra a chamada: a lista da turma deve carregar do cache.
7. Marque os presentes e confirme.
8. Confirme que não apareceu nenhuma mensagem de erro e que o indicador mostra 1 item pendente.
9. **Reinicie o dispositivo**, ainda em modo avião.
10. Reabra o app: o item pendente deve continuar na fila.
11. **Desative o modo avião.**
12. Sem tocar em nada, observe o indicador zerar.
13. No painel do Supabase, confirme que a chamada chegou **com a data da aula**, não com a data do envio.

⚠️ Se qualquer passo de 5 a 13 falhar, a feature **não está pronta**. Este roteiro é o critério real de aceitação.

### 5.5 Medição do tempo

1. Com 20 alunos matriculados em uma turma, cronometre da abertura do app até a confirmação da chamada.
2. O alvo é **menos de 90 segundos**.
3. Meça em aula real, com a turma presente e a pressa real. Bancada não vale: o número medido sentado, sem ninguém esperando, não representa o uso.

## 6. Verificação do isolamento do legado

Ao final de qualquer sessão de trabalho:

```bash
git status
```

Nenhuma linha de modificação ou deleção pode aparecer para:

```
lib/  test/  supabase/  docs/  web/  windows/
pubspec.yaml  pubspec.lock  analysis_options.yaml  .metadata
```

🟢 Se aparecer, a restrição de política foi violada e a alteração precisa ser revertida antes de prosseguir.

## 7. Deploy

1. Conecte o repositório ao Vercel.
2. Defina o diretório raiz do projeto como `apps/web`.
3. Configure as variáveis de ambiente no painel do Vercel, as mesmas do `.env.local`.
4. O deploy ocorre automaticamente no push para o branch principal.
5. Build que falha não publica; a versão anterior permanece servida.

## 8. Problemas conhecidos e o que fazer

| Sintoma | Causa provável | Ação |
|---|---|---|
| PWA não oferece instalação | Service worker não registrado, ou servindo por HTTP | Verifique HTTPS e o registro do service worker no DevTools |
| App não abre offline | Shell não foi pré-cacheado | Abra uma vez com rede antes de testar offline |
| Fila não esvazia ao voltar a rede | Portal cativo: a interface está conectada mas não há internet real | Confirme com uma requisição de verdade. O sistema deve detectar pela falha, não pelo status da interface |
| Consulta retorna zero linhas estando logado | Política de RLS ausente ou incorreta na tabela | Verifique a política no painel do Supabase |
| `pnpm test` passa com importação proibida | `dependency-cruiser` não configurado ou não incluído na suíte | Refaça a verificação negativa da seção 4 |
| Aluno criado offline some após sincronizar | Identidade local substituída em vez de preservada | O UUID v7 gerado no cliente é o definitivo (D-07); não deve haver substituição |

---
Gerado por `/reversa-plan` em 2026-10-04.
