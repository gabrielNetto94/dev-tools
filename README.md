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

Use a sidebar à esquerda para alternar entre os módulos:
- **Postgres Cloner**: clonagem de bancos PostgreSQL e lista de clones.
- **DynamoDB Workbench**: grade de itens e editor de atributos do DynamoDB.
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
   - Depois de conectar, o painel some e fica só o status no topo; o botão **"Conexão"** reabre.
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

