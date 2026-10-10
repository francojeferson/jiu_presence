---
schema_version: 1
id: BUG-20261009-NLLT
display_number: 1
title: Confirmação da chamada não é invalidada após editar presença
status: resolved
phase: delivering
express: true
severity: high
priority: P1
created: 2026-10-09
updated: 2026-10-10

origin:
  type: inspection
  external_ref:
    provider: internal-audit
    id: _reversa_refactor/auditoria-ponytail-2026-10-09.md#13

area: unclassified
module: unclassified
feature: unclassified
labels: []

visibility: normal
security_suspected: false

reproduction:
  classification: deterministic
  rate: "1/1"
  suspected_triggers: []

blocking: []
relationships: []

traceability:
  specs:
    - _reversa_sdd/sdd/chamada-e-presenca.md#61-requisitos-principais
  affected_code:
    - apps/web/src/app/chamada/page.tsx
  root_cause:
    state: confirmed
    hypothesis: >-
      O estado de confirmação vive só na tela e nada o invalidava. `confirmar`
      ligava `confirmada`; `alternar` mudava a lista sem desligá-lo.
    causal_path:
      - O professor confirma e `setConfirmada(true)` exibe "Chamada registrada".
      - Um toque chama `alternar`, que troca a chamada em memória.
      - Nada volta `confirmada` a `false`, então o aviso descreve a versão antiga.
    evidence:
      - ref: apps/web/e2e/chamada-offline.spec.ts:319
        observation: >-
          Com a correção revertida, o teste falha ao esperar que o aviso suma
          após a edição; com a correção, passa.
    code_refs:
      - file: apps/web/src/app/chamada/page.tsx
        symbol: alternar
        commit: 5446ba3
  reproduction_tests:
    - apps/web/e2e/chamada-offline.spec.ts:319
  regression_tests:
    - apps/web/e2e/chamada-offline.spec.ts:319

spec_verdict: spec-correta
change_set:
  - id: CHG-001
    kind: code
    artifact: apps/web/src/app/chamada/page.tsx
    purpose: Alternar uma presença volta a tela ao estado não confirmado.
  - id: CHG-002
    kind: test
    artifact: apps/web/e2e/chamada-offline.spec.ts
    purpose: Cobre confirmado, editado e reconfirmado, com recarga provando a persistência.

delivery:
  branch: main
  commit: 30db8f7
  pr: null
  ci: null

closure:
  policy: local-software
  satisfied: true
resolution_kind: fixed
---

# Confirmação da chamada não é invalidada após editar presença

## Summary

Depois de confirmar uma chamada, alterar uma presença mantém o aviso de confirmação anterior na tela, embora a versão editada ainda não tenha sido persistida.

## Expected Behavior

O RF-14 permite editar uma chamada confirmada. Ao iniciar essa edição, a interface deve deixar claro que a nova versão ainda precisa ser confirmada e persistida.

## Actual Behavior

O estado visual `confirmada` permanece ativo após alternar uma presença. O professor pode sair da tela acreditando que a edição foi salva.

## Steps to Reproduce

1. Abrir uma chamada com alunos matriculados.
2. Marcar uma presença e confirmar.
3. Alterar a presença de outro aluno.
4. Verificar que o aviso `Chamada registrada` continua visível.

## Evidence

- `../../../intake/relato-20261009-2343.md`
- `_reversa_refactor/auditoria-ponytail-2026-10-09.md`, item 13

## Suspected Area

O manipulador `alternar` em `apps/web/src/app/chamada/page.tsx` atualiza a chamada, mas não invalida o estado visual de confirmação.

## Acceptance Criteria

- Alterar qualquer presença após confirmar remove imediatamente o aviso de confirmação.
- Confirmar novamente persiste a lista atualizada e restaura o aviso.
- O fluxo confirmado, editado e reconfirmado fica coberto por teste.

## Traceability

- Spec: `_reversa_sdd/sdd/chamada-e-presenca.md#61-requisitos-principais`, RF-14.
- Código afetado: `apps/web/src/app/chamada/page.tsx`.
- Teste relacionado: `apps/web/e2e/chamada-offline.spec.ts`.

## Resolution

`resolution_kind: fixed`. Veredito de spec: **spec-correta** — o RF-14 já descrevia
o comportamento certo; apenas a tela não o cumpria.

**Causa raiz.** `confirmada` é estado só da tela. `confirmar` o ligava e nada o
desligava, então `alternar` mudava a lista deixando o aviso anterior visível.

**Change set.**

| ID | Tipo | Artefato | Propósito |
| --- | --- | --- | --- |
| CHG-001 | code | `apps/web/src/app/chamada/page.tsx` | `setConfirmada(false)` após uma alternância bem-sucedida. |
| CHG-002 | test | `apps/web/e2e/chamada-offline.spec.ts` | Cobre confirmado → editado → reconfirmado e a persistência na recarga. |

Entregue em `30db8f7`, direto na `main`, sem PR: é o fluxo das correções
anteriores desta estabilização.

O reset vem **depois** do `await`: se `alternarPresenca` falhar, por exemplo com a
carência de edição vencida, a lista não mudou e a confirmação continua verdadeira.

**Testes.** O mesmo cenário serve aos dois papéis, verificado nos dois sentidos:
com o `setConfirmada(false)` revertido ele falha, reproduzindo o defeito; com a
correção, passa. Suíte completa: 7 passaram e 1 continua ignorado por depender do
Supabase local.

## Agent Notes

- Severidade `high` e prioridade `P1` assumidas na rota expressa porque o estado visual incorreto pode causar perda de uma edição de presença.
- O veredito `spec-correta` foi assumido na rota expressa, não decidido por humano. Se discordar, remova `DONE.md` e reabra.
- Efeito colateral aceito: ao editar uma chamada reaberta, o aviso "Já havia uma chamada registrada" reaparece, porque ele depende de `!confirmada`. É verdade no momento em que aparece.
- Taxonomia proposta para futura inclusão: área `chamada`, módulo `presenca`, feature `edicao-de-chamada`. Os campos permanecem `unclassified` porque a taxonomia atual está vazia.
