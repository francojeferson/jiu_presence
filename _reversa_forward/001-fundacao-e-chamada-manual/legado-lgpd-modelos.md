# Modelos LGPD preservados do legado Flutter

> **RF-03 de [`descomissionamento-do-legado.md`](../../_reversa_sdd/sdd/descomissionamento-do-legado.md).**
> Preservado em 2026-10-11, fora da árvore de remoção **e dentro do histórico
> de versionamento** — `_reversa_sdd/` está no `.gitignore`, e preservar num
> diretório não versionado não preservaria nada.
>
> Origem: `docs/lgpd_models.md` (seções 1 e 2, cópia fiel) e
> `lib/screens/registration_screen.dart` linhas 257–269 (seção 3).
>
> **Cópia, não movimentação.** O original continua em `docs/` de propósito: o
> `git status` nos caminhos legados estar vazio é critério de regressão ativo
> do projeto (`regression-watch.md`, O003), e o guard do CI falharia. A Fase 6
> do descomissionamento apaga o original — este arquivo é o que sobrevive.

---

## ⚠️ Antes de reusar, leia isto

O motivo de preservar é econômico: reescrever termo de consentimento e
política de privacidade custa tempo e provavelmente honorário advocatício, e
o risco R6 do PRD prevê a reabertura da LGPD. **Mas nada aqui serve como está.**

**1. Nunca foi finalizado.** Os campos `[NOME DO SEU APP]`, `[SEU NOME]`,
`[seu cpf]`, `[seu email]` e `suporte@seuapp.com` são todos marcadores. O
documento é esqueleto jurídico, não instrumento assinável.

**2. Compromete-se com decisões que hoje estão em aberto.** O termo afirma
*"embedding biométrico (vetor matemático do rosto – 128 dimensões)"* e a
política afirma *"Embeddings: armazenados com pgvector"*. As duas coisas são
exatamente a **OQ-01** ainda sem resposta: a dimensão N é saída do spike, e
`pgvector` nem foi habilitado, justamente para não fixar a dimensão cedo
(risco R4). Reusar o texto sem revisar significa prometer ao titular um
formato de dado que ainda não foi escolhido.

**3. Descreve dados que o modelo novo não coleta.** O termo lista *"Nome,
idade, peso, altura, cor de faixa"* e exige CPF do titular e do responsável.
No PWA, **peso e altura não existem**, **CPF foi removido** (RN-09: existia
para o termo LGPD e para a cobrança, ambos fora de escopo) e **idade virou
data de nascimento**, da qual a escala de faixa é derivada.

**4. Promete criptografia e localidade que ninguém verificou.** *"tratamento
realizado exclusivamente no território brasileiro, com criptografia forte"* e
*"Fotos originais: criptografadas no Supabase Storage (AWS Brasil)"* são
afirmações sobre uma infraestrutura que **nunca foi exercitada** — o Supabase
hospedado é o maior risco residual do projeto. Afirmar isso num termo
assinado sem conferir a região do projeto é exposição real.

**5. Há duas versões do termo, e a que o usuário via era a curta.** A seção 3
abaixo é o texto que de fato aparecia na tela, e ele **difere** do documento
longo: omite CPF, omite a lista de dados tratados, e resume os direitos numa
linha. Se o termo longo é o instrumento jurídico, a versão curta é a que
registra o que foi efetivamente consentido.

---

## 1. Termo de Consentimento Digital para Tratamento de Dados Biométricos

> Cópia fiel de `docs/lgpd_models.md`, seção 1.

```
TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS SENSÍVEIS
(Lei Geral de Proteção de Dados – LGPD – Lei nº 13.709/2018)

Eu, [NOME COMPLETO DO TITULAR ou RESPONSÁVEL LEGAL], CPF [xxx.xxx.xxx-xx], na qualidade de:
( ) Titular (maior de 18 anos)    ( ) Responsável Legal do menor [NOME DO ALUNO], CPF do menor [xxx.xxx.xxx-xx]

DECLARO que li e compreendi integralmente a Política de Privacidade do aplicativo [NOME DO SEU APP] e CONSINTO, de forma livre, informada e inequívoca, com o tratamento dos meus dados pessoais sensíveis (ou do menor sob minha responsabilidade) para a finalidade exclusiva de:

• Reconhecimento facial para registro automático de presença em aulas;
• Geração de relatórios de frequência e controle de troca de faixa;
• Armazenamento da foto original enviada pelo professor e do embedding biométrico (vetor matemático do rosto – 128 dimensões).

Dados que serão tratados:
- Foto do rosto (foto original)
- Embedding biométrico (não é uma imagem, é um vetor matemático irreversível)
- Nome, idade, peso, altura, cor de faixa

O tratamento será realizado exclusivamente no território brasileiro, com criptografia forte. Os dados serão mantidos enquanto o aluno estiver ativo na academia + 1 ano após o término para fins de auditoria.

Meus direitos (LGPD arts. 18 e 19):
- Acesso, correção, exclusão e revogação do consentimento a qualquer momento (exclusão automática do embedding e foto).
- Revogação não afeta tratamentos anteriores.

Estou ciente de que posso revogar este consentimento a qualquer momento pelo e-mail suporte@seuapp.com ou dentro do app, sem qualquer ônus.

Data: ____/____/______
Assinatura digital: [campo de nome + botão "Eu concordo" + registro de IP e timestamp]

Responsável Legal (obrigatório se menor de 18 anos): ________________________ CPF: _______________
```

## 2. Política de Privacidade

> Cópia fiel de `docs/lgpd_models.md`, seção 2.

```
POLÍTICA DE PRIVACIDADE – [NOME DO SEU APP]
Versão 1.0 – Março/2026

1. Dados coletados
• Cadastro: nome, idade, peso, altura, cor de faixa, foto do rosto.
• Presença: foto da turma enviada pelo professor + embeddings biométricos.
• Dados sensíveis: biometria facial (LGPD Art. 5º, II).

2. Finalidade
Registro automático de presença e controle de graduação em academias de artes marciais.

3. Compartilhamento
Nunca vendemos ou compartilhamos dados. Apenas o professor da academia tem acesso aos relatórios.

4. Armazenamento e segurança
• Fotos originais: criptografadas no Supabase Storage (AWS Brasil).
• Embeddings: armazenados com pgvector (não é possível reverter para foto).
• Prazo: enquanto ativo + 1 ano máximo.

5. Direitos do titular (LGPD)
Acesso, correção, eliminação, revogação. Solicite pelo e-mail suporte@seuapp.com. Responderemos em até 15 dias.

6. Crianças e adolescentes
Exigimos consentimento expresso do responsável legal + verificação de idade no cadastro.

Controlador: [SEU NOME], CPF [seu cpf], e-mail [seu email].
```

## 3. Versão curta — a que o usuário realmente via

> Cópia fiel de `lib/screens/registration_screen.dart`, linhas 257–269.
> Aparecia num *bottom sheet*, aberto ao tocar em "Li e concordo com o Termo
> de Consentimento LGPD". O cadastro era recusado sem o aceite, com a
> mensagem *"Você deve aceitar os termos LGPD para continuar."*

```
TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS SENSÍVEIS (Lei nº 13.709/2018)

DECLARO que li e compreendi integralmente a Política de Privacidade e CONSINTO com o tratamento dos meus dados (ou do menor sob minha responsabilidade) para:

- Reconhecimento facial automático de presença.
- Relatórios de frequência e graduação.
- Armazenamento da foto e do embedding biométrico.

Os dados são tratados no Brasil com criptografia forte e mantidos até 1 ano após inatividade.

Direitos: Acesso, correção, exclusão e revogação a qualquer momento.

Assinatura digital ocorre ao aceitar no app.
```

---

## O que vale reaproveitar

| Elemento | Veredito |
|---|---|
| Estrutura do termo (finalidade, dados, prazo, direitos, responsável legal) | **Reusar.** É o esqueleto que custa tempo de advogado |
| Base legal e artigos citados (Lei 13.709/2018, arts. 5º II, 18, 19) | **Reusar.** Estão corretos |
| Distinção titular × responsável legal de menor | **Reusar.** Metade do público do dojo é infantil |
| Prazo de retenção "ativo + 1 ano" | **Decidir de novo.** Foi escolhido sem critério registrado |
| Lista de dados tratados | **Reescrever.** Não corresponde ao modelo novo |
| "128 dimensões" e "pgvector" | **Remover até o spike decidir.** É a OQ-01 |
| Afirmações sobre criptografia e região | **Verificar antes de assinar.** Nunca foram conferidas |
| Marcadores `[NOME DO SEU APP]` etc. | **Preencher.** O documento nunca foi finalizado |
