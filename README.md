# DEVinho Suite 🍷

Suite web moderna, rápida e estilizada com a identidade **DEVinho** para desenvolvimento e dados, contendo três módulos principais:
1. **🐘 Postgres Cloner**: Seleção e clonagem rápida de bancos de dados PostgreSQL por streaming em memória (`pg_dump | pg_restore`) e forks instantâneos via `TEMPLATE`.
2. **⚡ DynamoDB Workbench**: Interface inspirada no NoSQL Workbench para conectar a contas AWS Cloud ou DynamoDB Local, explorar tabelas, listar itens e inspecionar/editar variáveis e atributos em tempo real (via formulário visual ou JSON raw).
3. **🔑 DocuSign Token**: Gerador de tokens de autenticação para DocuSign via OAuth 2.0 JWT Bearer Grant (RFC 7523), com suporte flexível a JSON de credenciais, chave privada PEM e link de consentimento prévio.

---

## ⚡ Como Iniciar

1. Na pasta do projeto, execute:
```bash
docker compose up -d --build
```

2. Abra no navegador:
**[http://localhost:3000](http://localhost:3000)**

---

## 🧭 Menu Lateral Retrátil

Use a sidebar à esquerda para alternar entre os módulos:
- **Postgres Cloner**: clonagem de bancos PostgreSQL e lista de clones.
- **DynamoDB Workbench**: grade de itens e editor de atributos do DynamoDB.
- **DocuSign Token**: gerador de asserção JWT e emissor de Access Token da DocuSign.
- Cada módulo mostra um ponto com o estado da conexão (verde conectado, âmbar/vermelho com falha, vinho durante uma clonagem).
- A sidebar recolhe para um trilho de ícones pelo botão no topo ou com `Ctrl+B`. Abaixo de 1100px ela fica sempre recolhida.

---

## 🛠️ Módulo 1: Postgres Cloner

O fluxo fica à esquerda em três passos; log, resultado e clones ficam à direita.

1. **Origem:**
   - Conecta automaticamente ao servidor de origem padrão (`host.docker.internal:5432`).
   - Escolha o banco no seletor com busca (cada opção mostra o tamanho) ou clique em **"Trocar"** para apontar para outro Postgres. Se a conexão falhar, o formulário do servidor abre com o erro.
2. **Destino:**
   - Escolha o servidor de destino: **Docker local** (container do DEVinho), **Mesmo da origem** ou **Outro servidor** (host, porta, usuário e senha).
   - Escolha entre **Criar novo banco** (com nome sugerido) ou **Sobrescrever existente**, que lista os bancos do destino e avisa o que será apagado.
   - Defina o modo de cópia (*Completo* ou *Somente schema*).
3. **Clonar:**
   - Clique em **"Clonar banco"** e acompanhe o log em tempo real via Server-Sent Events (SSE). Ao terminar, o log recolhe e a URL de conexão aparece pronta para copiar.
4. **Clones:**
   - Cada clone tem copiar URL, **"Fork rápido"** (novo clone em 1 segundo via `TEMPLATE`) e excluir, que pede o nome do banco para confirmar.

---

## ⚡ Módulo 2: DynamoDB Workbench

1. **Conexão:**
   - Suporta credenciais vindas de variáveis de ambiente (`.env`) ou informadas na tela.
   - **Atalhos de endpoint:**
     - **AWS**: informe região, Access Key e Secret Access Key.
     - **Docker**: conecta ao container `dynamodb-local` (`http://dynamodb-local:8000`).
     - **Host**: conecta ao DynamoDB local na máquina host (`http://localhost:8000`).
     - **LocalStack**: conecta ao endpoint LocalStack (`http://localhost:4566`).
   - Depois de conectar, o painel some e fica só o status no topo; o botão **"Conexão"** reabre. A última conexão fica salva no navegador (`localStorage`) e reconecta automaticamente ao abrir o app.
2. **Tabelas:**
   - Lista as tabelas com filtro por nome.
   - Mostra as chaves primárias da tabela aberta: **PK (Partition Key)** e **SK (Sort Key)**.
3. **Grade de itens:**
   - Escaneia e exibe os itens com a PK fixa à esquerda, tipo do atributo no cabeçalho e rolagem horizontal.
   - Clique em **"Novo item"** para criar ou no lápis da linha para editar; cada linha também tem copiar JSON e excluir.
4. **Editor de item (painel lateral):**
   - **Aba Visual**: adicione atributos, altere tipos (`String`, `Number`, `Boolean`, `Map`, `List`, `Null`) e edite valores campo a campo.
   - **Aba JSON**: editor com validação de sintaxe em tempo real, sincronizado com a aba Visual.

---

## 🔑 Módulo 3: DocuSign Token

Permite gerar tokens de autenticação da DocuSign via OAuth 2.0 JWT Bearer Grant ([RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523)) para integrações machine-to-machine.

1. **Parâmetros e Identificação Flexível:**
   - **Ambiente:** escolha entre **Demo (Sandbox)** (`account-d.docusign.com`) e **Produção** (`account.docusign.com`).
   - Os campos aceitam tanto os nomes da DocuSign quanto os nomes das colunas da tabela `tb_integradoras`:
     - **Client ID / Integration Key:** `integradora_chave`
     - **User ID:** `integradora_secret_key` (GUID do usuário personificado)
     - **Account ID (opcional):** `integradora_account_id`
2. **Entrada Flexível da Chave Privada RSA:**
   - Aceita o texto da chave privada PEM (`-----BEGIN RSA PRIVATE KEY-----`) direto.
   - **Ou aceita a colagem do JSON completo**, extraindo automaticamente o campo `privateRSAKey` (e preenchendo os demais campos se presentes no JSON).
   - Suporta upload de arquivos `.pem`, `.key` ou `.json`.
3. **Geração e Ações:**
   - **Gerar Access Token:** assina a asserção JWT com RS256 e requisita o `access_token` oficial no endpoint OAuth da DocuSign (`/oauth/token`).
   - **Apenas Gerar JWT:** gera a asserção JWT assinada offline sem realizar chamada externa.
   - **One-Time Consent:** se a conta DocuSign ainda não tiver consentimento prévio concedido (`consent_required`), o sistema exibe um alerta claro com link direto e botão de copiar a URL de autorização.

---

## 🐘 Versões do PostgreSQL

- O destino roda `postgres:18-alpine` (volume `pg_data18`) e a imagem do app instala o cliente `postgresql18-client`.
- O `pg_dump` precisa ter versão **igual ou maior** que a do servidor de origem, e o destino precisa ser **igual ou maior** que o `pg_restore`.

---

## 🧪 Testes Automatizados

Com a stack rodando (`docker compose up -d --build`):
```bash
cd app && npm test
```
A suíte roda com o test runner nativo do Node.js (`node:test`) e cobre endpoints do Postgres Cloner e CRUD completo do DynamoDB Workbench.

---

## 🤖 Agentes Especializados

Os agentes vivem em `.agents/skills/` e são roteados pelo `GEMINI.md`:
- `planner`: Planejamento e checklist de impacto antes de modificações.
- `architect`: Guardião da arquitetura, modularidade, regra de 300-400 linhas e lógica pura de domínio.
- `implementer`: Implementação de tarefas planejadas, correções e fatias de refatoração sem desvio de escopo.
- `tester`: Criação de testes unitários/integração, testes de caracterização e prevenção de regressões com `node:test`.
- `ui`: Modificações em HTML, CSS e JavaScript do frontend (design system DEVinho).
- `regression-reviewer`: Revisão de diffs pré-conclusão contra regras do projeto, contratos e regressões.
- `ui-reviewer`: Auditoria de conformidade visual, tokens de design, densidade e responsividade.
- `platform-reviewer`: Revisão de ambientes Docker, rede host (`host.docker.internal`) e paridade de versões do PostgreSQL.
- `postgres-specialist`: Streaming com `pg_dump | pg_restore`, `TEMPLATE` e backend Postgres.
- `dynamodb-specialist`: Operações no DynamoDB, NoSQL Workbench, edição de variáveis e AWS SDK.
- `docker-specialist`: Docker Compose, Dockerfile, portas, volumes e redes.
- `security-specialist`: Segurança de credenciais, validação de inputs e processos.
- `docs`: Sincronização contínua de documentação, README, CONTEXT e agentes.

Para o contexto técnico e arquitetural completo da aplicação, consulte [CONTEXT.md](file:///home/gabriel/me/dblab/CONTEXT.md).

