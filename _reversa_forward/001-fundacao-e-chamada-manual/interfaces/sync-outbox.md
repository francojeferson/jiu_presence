# Interface: Sincronização do Outbox

> Identificador: `001-fundacao-e-chamada-manual`
> Tipo: HTTP, via PostgREST do Supabase
> Data: `2026-10-04`

## 1. Propósito

Define o protocolo entre o outbox local e o Supabase. Não é uma API própria — é o SDK do Supabase sobre PostgREST — mas as garantias de idempotência, ordenação e classificação de erro são contrato, e precisam ser especificadas para que a implementação seja verificável.

## 2. Garantias exigidas

| Garantia | Como é obtida |
|---|---|
| Entrega ao menos uma vez | O item permanece no outbox até confirmação explícita do servidor |
| Efeito exatamente uma vez | `id` UUID v7 gerado no cliente, mais restrições de unicidade no banco (D-08) |
| Ordenação | Campo `ordem` monotônico local; envio estritamente sequencial |
| Durabilidade | Item só sai do outbox após resposta de sucesso ou classificação como falha permanente |
| Preservação temporal | `criado_em` é a data do evento; o servidor nunca substitui por `now()` em campos de negócio |

## 3. Operações

### 3.1 `criar_chamada`

```
POST /rest/v1/chamada
Prefer: resolution=merge-duplicates, return=representation
```

```json
{
  "id": "<uuid v7 do item do outbox>",
  "turma_id": "<uuid>",
  "data": "2026-10-04",
  "realizada_em": "2026-10-04T19:02:11.431Z",
  "origem": "manual",
  "confirmada": true,
  "criada_offline": true
}
```

| Resposta | Classificação | Ação |
|---|---|---|
| `201` | sucesso | Remover do outbox |
| `409` em `chamada_pkey` | **sucesso idempotente** | O item já havia sido gravado em tentativa anterior. Remover do outbox, não tratar como erro |
| `409` em `chamada_turma_id_data_key` com `id` diferente | conflito real | Falha permanente. Existe outra chamada para a mesma turma e data (EC-10 de `chamada-e-presenca`) |
| `401` | transitório | Renovar sessão e retentar. Nunca descartar o item |
| `5xx`, timeout, rede | transitório | Retentar com espera exponencial |

🟡 A distinção entre os dois casos de `409` é o ponto mais delicado do protocolo. Conflito na chave primária significa "você já me mandou isso" e é sucesso; conflito na unicidade de negócio com `id` diferente significa "outro registro ocupa esse lugar" e é falha permanente. Tratar ambos igual quebra a idempotência ou perde dado, dependendo do lado para o qual se erre.

### 3.2 `criar_presenca`

```
POST /rest/v1/presenca
```

```json
{
  "id": "<uuid v7>",
  "chamada_id": "<uuid da chamada>",
  "aluno_id": "<uuid do aluno>",
  "origem": "manual",
  "confianca": null,
  "registrada_em": "2026-10-04T19:02:11.431Z"
}
```

| Resposta | Classificação | Ação |
|---|---|---|
| `201` | sucesso | Remover do outbox |
| `409` em `presenca_pkey` | sucesso idempotente | Remover do outbox |
| `409` em `presenca_chamada_id_aluno_id_key` | sucesso idempotente | O aluno já consta nessa chamada. O fato desejado já é verdade; remover do outbox |
| `409` violação de chave estrangeira em `chamada_id` | transitório | A chamada ainda não subiu. A ordenação deveria prevenir (RF-25); se ocorrer, retentar após o item anterior |

🟡 Aqui, diferente de `criar_chamada`, o conflito de unicidade de negócio é sucesso: a intenção era "este aluno esteve presente nesta chamada", e isso já é verdade. Não há informação a perder.

### 3.3 `remover_presenca`

```
DELETE /rest/v1/presenca?id=eq.<uuid>
```

| Resposta | Classificação | Ação |
|---|---|---|
| `204` | sucesso | Remover do outbox |
| `204` com zero linhas afetadas | sucesso idempotente | Já havia sido removida, ou nunca subiu. O estado desejado é o atual |

### 3.4 `criar_aluno`, `atualizar_aluno`, `inativar_aluno`, `excluir_aluno`

```
POST /rest/v1/aluno          (criar)
PATCH /rest/v1/aluno?id=eq.<uuid>  (atualizar, inativar)
DELETE /rest/v1/aluno?id=eq.<uuid> (excluir)
```

| Resposta | Classificação | Ação |
|---|---|---|
| `201` ou `204` | sucesso | Remover do outbox |
| `409` em `aluno_pkey` no criar | sucesso idempotente | Remover do outbox |
| `404` no atualizar | falha permanente | O aluno foi removido no servidor. Apresentar ao professor com motivo legível |
| `204` ou `404` no excluir | sucesso idempotente | O estado desejado já foi alcançado |
| `409 / 23503` no excluir | falha permanente | Há histórico no servidor; orientar a inativação |
| `400` violação de constraint de faixa | falha permanente | Dado inválido. Nunca retentar em laço |

### 3.5 `criar_turma`, `atualizar_turma`, `excluir_turma`, `criar_matricula`, `encerrar_matricula`

Mesma classificação das operações de aluno. Turma com chamada no servidor não
pode ser excluída; a falha orienta sua desativação. `criar_matricula` usa chave
composta `(aluno_id, turma_id, matriculado_em)`; conflito nela é sucesso
idempotente.

## 4. Classificação de erro

```
transitório  → permanece no outbox, retenta com espera exponencial
               rede, timeout, 401, 5xx, 429, violação temporária de FK

permanente   → sai do outbox ativo, vai para a lista de falhas
               404, 400 por validação, 409 de conflito real de negócio
               nunca descartado em silêncio; exige decisão do professor

sucesso      → removido do outbox
               2xx, e os 409 explicitamente classificados como idempotentes acima
```

🟡 Qualquer código não listado é tratado como **transitório**. Errar para o lado de retentar preserva o dado; errar para o lado de descartar o perde.

## 5. Política de reenvio

| Tentativa | Espera |
|---|---|
| 1 | imediata |
| 2 | 2 s |
| 3 | 8 s |
| 4 | 30 s |
| 5 | 2 min |
| 6 em diante | 10 min, teto fixo |

🟡 Sem limite máximo de tentativas para falhas transitórias: o dispositivo pode ficar dias offline, e abandonar um item por contagem de tentativas significaria perder uma chamada registrada pelo professor.

## 6. Protocolo de processamento

```
enquanto houver item pendente com proxima_tentativa_em <= agora:
  item := o de menor `ordem`
  se já existe item em estado 'enviando': aguardar        # EC-08: sem concorrência
  marcar item como 'enviando'
  enviar
  classificar a resposta
    sucesso    -> remover do outbox
    transitório-> voltar a 'pendente', incrementar tentativas, agendar
    permanente -> marcar 'falha_permanente', registrar erro legível, notificar
  se transitório: interromper o laço                      # preserva a ordem (RF-25)
```

🟡 Interromper o laço na primeira falha transitória é deliberado: continuar enviando itens posteriores violaria a ordenação e poderia produzir violação de chave estrangeira — por exemplo, a presença de um aluno cuja criação ainda não subiu.

## 7. Detecção de conectividade

🟡 O status da interface de rede **não** é confiável: portal cativo reporta conectado sem internet real (EC-01 de `sincronizacao-offline-first`). A verdade vem da requisição em si. O evento de reconexão serve apenas como gatilho para tentar; a confirmação vem do resultado.

## 8. Autenticação

Todas as requisições carregam o token da sessão do professor. Expirada, renovar antes de processar a fila. Se a renovação falhar, manter a fila intacta e aguardar nova autenticação — **nunca** descartar pendência por falta de sessão (EC-12 de `sincronizacao-offline-first`).

## 9. Timeouts

| Operação | Timeout |
|---|---|
| Item individual | 15 s |
| Verificação de conectividade | 5 s |

🟡 Timeout é sempre transitório. O item volta à fila, e a chave de idempotência garante que um eventual processamento no servidor não produza duplicata no reenvio.

---
Gerado por `/reversa-plan` em 2026-10-04.
