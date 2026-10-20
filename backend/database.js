// backend/database.js
const Database = require("better-sqlite3");
const path = require("path");

// O banco fica em futebol_empresa/database/futebol.db
const dbPath = path.join(__dirname, "..", "database", "futebol.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

db.exec(`
        CREATE TABLE IF NOT EXISTS jogadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        admin INTEGER NOT NULL DEFAULT 0,
        ativo INTEGER NOT NULL DEFAULT 1,
        time TEXT DEFAULT NULL,              -- NOVO: 'A', 'B' ou null
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

        CREATE TABLE IF NOT EXISTS jogos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        local TEXT NOT NULL,
        valor REAL DEFAULT 40.00,
        minimo_jogadores INTEGER DEFAULT 14,
        gols_time_a INTEGER DEFAULT NULL,  -- NOVO
        gols_time_b INTEGER DEFAULT NULL,  -- NOVO
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS presencas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jogador_id INTEGER NOT NULL,
        jogo_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (jogador_id) REFERENCES jogadores(id),
        FOREIGN KEY (jogo_id) REFERENCES jogos(id),

        UNIQUE(jogador_id, jogo_id)
    );

        CREATE TABLE IF NOT EXISTS mensalidades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jogador_id INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        valor REAL NOT NULL DEFAULT 40.00,
        status TEXT NOT NULL DEFAULT 'pendente',
        data_pagamento DATETIME,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (jogador_id) REFERENCES jogadores(id),

        UNIQUE(jogador_id, mes, ano)
    );
        CREATE TABLE IF NOT EXISTS controle_mensalidade (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mes INTEGER NOT NULL,
        ano INTEGER NOT NULL,
        valor_padrao REAL NOT NULL DEFAULT 40.00,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(mes, ano)
    );

    CREATE TABLE IF NOT EXISTS lembretes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jogador_id INTEGER NOT NULL,
        mensalidade_id INTEGER,
        mensagem TEXT,
        enviado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (jogador_id) REFERENCES jogadores(id),
        FOREIGN KEY (mensalidade_id) REFERENCES mensalidades(id)
    );

    CREATE TABLE IF NOT EXISTS avisos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jogadores_times (
        jogador_id INTEGER NOT NULL,
        time_id INTEGER NOT NULL,

        PRIMARY KEY (jogador_id, time_id),

        FOREIGN KEY (jogador_id) REFERENCES jogadores(id),
        FOREIGN KEY (time_id) REFERENCES times(id)
    );
`);

console.log("✅ Banco de dados conectado e tabelas verificadas.");

module.exports = db;