# DEVinho Suite 🍷

Suite web moderna, rápida e estilizada com a identidade **DEVinho** para desenvolvimento de bancos de dados, contendo dois módulos principais:
1. **🐘 Postgres Cloner**: Seleção e clonagem rápida de bancos de dados PostgreSQL por streaming em memória (`pg_dump | pg_restore`) e forks instantâneos via `TEMPLATE`.
2. **⚡ DynamoDB Workbench**: Interface inspirada no NoSQL Workbench para conectar a contas AWS Cloud ou DynamoDB Local, explorar tabelas, listar itens e inspecionar/editar variáveis e atributos em tempo real (via formulário visual ou JSON raw).

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

Use o menu lateral à esquerda para alternar instantaneamente entre os módulos:
- **🐘 Postgres Cloner**: Gerenciamento de instâncias e clonagem de PostgreSQL.
- **⚡ DynamoDB Workbench**: Inspetor e editor de variáveis do DynamoDB.
- O menu pode ser recolhido/expandido clicando no botão de seta no topo da barra.

---

## 🛠️ Módulo 1: Postgres Cloner

1. **Selecionar o Banco de Origem:**
   - Conecta automaticamente ao servidor de origem padrão (`host.docker.internal:5432`).
   - Escolha o banco no menu suspenso ou clique em **"Trocar Servidor"** para apontar para outro Postgres.
2. **Clonar por Streaming:**
   - Defina o nome do clone e selecione o modo (*Completo* ou *Schema-only*).
   - Clique em **"Clonar Banco Selecionado"** e acompanhe os logs em tempo real via Server-Sent Events (SSE).
3. **Conectar e Usar:**
   - Copie a URL gerada para o DBeaver/psql ou use o botão **"⚡ Fork Rápido"** para criar novos clones em 1 segundo via `TEMPLATE`.

---

## ⚡ Módulo 2: DynamoDB Workbench

1. **Configuração de Conexão & Credenciais:**
   - Suporta conexão automática a partir de variáveis de ambiente (`.env`) ou credenciais informadas na tela.
   - **Atalhos rápidos:**
     - ☁️ **AWS Nuvem**: informe Region, Access Key e Secret Access Key.
     - 🐳 **Docker Local**: conecta ao container `dynamodb-local` (`http://dynamodb-local:8000`).
     - 💻 **Host Local**: conecta ao DynamoDB local na máquina host (`http://localhost:8000`).
     - ⚡ **LocalStack**: conecta ao endpoint LocalStack (`http://localhost:4566`).
2. **Explorador de Tabelas:**
   - Lista as tabelas disponíveis com filtro de busca em tempo real.
   - Mostra metadados e badges das chaves primárias: **PK (Partition Key)** e **SK (Sort Key)**.
3. **Inspetor de Variáveis e Itens:**
   - Escaneia e exibe os itens em uma tabela dinâmica com as chaves PK e SK destacadas.
   - Clique em **"➕ Nova Variável / Item"** para criar um item ou **"✏️ Editar"** para alterar variáveis existentes.
4. **Editor Visual & JSON Raw:**
   - **Aba Visual**: adicione, altere tipos (`String`, `Number`, `Boolean`, `JSON/Map`, `List`, `Null`) e edite valores campo a campo.
   - **Aba JSON Raw**: editor de código com validação de sintaxe JSON em tempo real sincronizado automaticamente com o formulário visual.

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
- `planner`: Planejamento e especificações antes de modificações.
- `tester`: Criação, execução e prevenção de regressões em testes.
- `ui`: Modificações em HTML, CSS e JavaScript do frontend.
- `postgres-specialist`: Streaming com `pg_dump | pg_restore`, `TEMPLATE` e backend Postgres.
- `dynamodb-specialist`: Operações no DynamoDB, NoSQL Workbench, edição de variáveis e AWS SDK.
- `docker-specialist`: Docker Compose, Dockerfile, portas e redes.
- `security-specialist`: Segurança de credenciais, validação de inputs e processos.
- `docs`: Sincronização contínua de documentação e agentes.

