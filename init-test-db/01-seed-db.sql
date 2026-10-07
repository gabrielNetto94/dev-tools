-- ==============================================================================
-- Banco Oficial de Teste e Seed (seed_db)
-- Utilize SEMPRE este banco como origem padrão para validar testes de clonagem
-- ==============================================================================

CREATE DATABASE seed_db;
\c seed_db

-- Criar Schema Dedicado 'seed'
CREATE SCHEMA IF NOT EXISTS seed;
SET search_path TO seed, public;

-- 1. Categorias
CREATE TABLE seed.categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Usuários
CREATE TABLE seed.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Produtos
CREATE TABLE seed.products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES seed.categories(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    sku VARCHAR(30) UNIQUE NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Pedidos
CREATE TABLE seed.orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES seed.users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Itens do Pedido
CREATE TABLE seed.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES seed.orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES seed.products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL
);

-- Índices no Schema seed
CREATE INDEX idx_products_category ON seed.products(category_id);
CREATE INDEX idx_orders_user ON seed.orders(user_id);
CREATE INDEX idx_order_items_order ON seed.order_items(order_id);

-- Povoamento de Dados (Seed Básico)
INSERT INTO seed.categories (name, description) VALUES
    ('Hardware', 'Peças e componentes de computador'),
    ('Periféricos', 'Teclados, mouses, monitores e fones'),
    ('Acessórios', 'Cabos, suportes e adaptadores');

INSERT INTO seed.users (name, email, role) VALUES
    ('Gabriel Souza', 'gabriel@exemplo.com', 'admin'),
    ('Ana Beatriz', 'ana.beatriz@exemplo.com', 'customer'),
    ('Marcos Vinicius', 'marcos.v@exemplo.com', 'customer'),
    ('Juliana Mendes', 'juliana.m@exemplo.com', 'customer');

INSERT INTO seed.products (category_id, name, sku, price, stock) VALUES
    (2, 'Teclado Mecânico Custom Gateron Red', 'KB-GAT-RED', 420.00, 35),
    (2, 'Mouse Gamer Ergonômico 16000 DPI', 'MO-ERG-16K', 260.00, 50),
    (2, 'Monitor IPS 27" 144Hz 1ms', 'MON-27-144', 1450.00, 12),
    (1, 'Processador Octa-Core 4.5GHz', 'CPU-8C-45', 1280.00, 20),
    (1, 'Memória RAM 16GB DDR5 5600MHz', 'RAM-16-DDR5', 380.00, 80),
    (3, 'Braço Articulado para Monitor', 'ACC-ARM-01', 190.00, 45);

INSERT INTO seed.orders (user_id, status, total_amount) VALUES
    (2, 'completed', 680.00),
    (3, 'completed', 1450.00),
    (4, 'pending', 380.00);

INSERT INTO seed.order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 420.00),
    (1, 2, 1, 260.00),
    (2, 3, 1, 1450.00),
    (3, 5, 1, 380.00);
