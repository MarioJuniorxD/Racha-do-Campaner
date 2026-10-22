const path = require("path");

const isProduction = process.env.DATABASE_URL;

let db;

if (isProduction) {
  // ===== PRODUÇÃO (RENDER + POSTGRES) =====
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('error', (err) => {
    console.error('❌ Erro no pool do Postgres:', err);
  });

  db = {
    query: (text, params) => pool.query(text, params),
    prepare: (text) => {
      // Substitui ? por $1, $2, $3... de forma automática
      let index = 0;
      const query = text.replace(/\?/g, () => `$${++index}`);

      return {
        get: async (...params) => {
          const res = await pool.query(query, params);
          return res.rows[0];
        },
        all: async (...params) => {
          const res = await pool.query(query, params);
          return res.rows;
        },
        run: async (...params) => {
          const res = await pool.query(query, params);
          return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id };
        }
      };
    }
  };

  const criarTabelas = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS jogadores (
          id SERIAL PRIMARY KEY, nome TEXT NOT NULL, telefone TEXT NOT NULL UNIQUE,
          senha TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1,
          time TEXT DEFAULT NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS jogos (
          id SERIAL PRIMARY KEY, data TEXT NOT NULL, horario TEXT NOT NULL, local TEXT NOT NULL,
          valor REAL DEFAULT 40.00, minimo_jogadores INTEGER DEFAULT 14,
          gols_time_a INTEGER DEFAULT NULL, gols_time_b INTEGER DEFAULT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS presencas (
          id SERIAL PRIMARY KEY, jogador_id INTEGER NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
          jogo_id INTEGER NOT NULL REFERENCES jogos(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pendente', atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(jogador_id, jogo_id)
        );
        CREATE TABLE IF NOT EXISTS mensalidades (
          id SERIAL PRIMARY KEY, jogador_id INTEGER NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
          mes INTEGER NOT NULL, ano INTEGER NOT NULL, valor REAL NOT NULL DEFAULT 40.00,
          status TEXT NOT NULL DEFAULT 'pendente', data_pagamento TIMESTAMP,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(jogador_id, mes, ano)
        );
        CREATE TABLE IF NOT EXISTS controle_mensalidade (
          id SERIAL PRIMARY KEY, mes INTEGER NOT NULL, ano INTEGER NOT NULL,
          valor_padrao REAL NOT NULL DEFAULT 40.00, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(mes, ano)
        );
        CREATE TABLE IF NOT EXISTS avisos (
          id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, mensagem TEXT NOT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ Tabelas Postgres criadas/verificadas com sucesso.");
    } catch (err) {
      console.error("❌ ERRO AO CRIAR TABELAS:", err);
    }
  };

  // Exporta uma Promise que só resolve depois das tabelas serem criadas
  module.exports = new Promise(async (resolve) => {
    await criarTabelas();
    resolve(db);
  });

} else {
  // ===== DESENVOLVIMENTO (SEU PC + SQLITE) =====
  const Database = require("better-sqlite3");
  const dbPath = path.join(__dirname, "database", "futebol.db");
  const dbLocal = new Database(dbPath);
  dbLocal.pragma("foreign_keys = ON");

  dbLocal.exec(`
    CREATE TABLE IF NOT EXISTS jogadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, telefone TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1,
      time TEXT DEFAULT NULL, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS jogos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, horario TEXT NOT NULL, local TEXT NOT NULL,
      valor REAL DEFAULT 40.00, minimo_jogadores INTEGER DEFAULT 14,
      gols_time_a INTEGER DEFAULT NULL, gols_time_b INTEGER DEFAULT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS presencas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, jogador_id INTEGER NOT NULL, jogo_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente', atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jogador_id) REFERENCES jogadores(id), FOREIGN KEY (jogo_id) REFERENCES jogos(id),
      UNIQUE(jogador_id, jogo_id)
    );
    CREATE TABLE IF NOT EXISTS mensalidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT, jogador_id INTEGER NOT NULL, mes INTEGER NOT NULL,
      ano INTEGER NOT NULL, valor REAL NOT NULL DEFAULT 40.00, status TEXT NOT NULL DEFAULT 'pendente',
      data_pagamento DATETIME, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jogador_id) REFERENCES jogadores(id), UNIQUE(jogador_id, mes, ano)
    );
    CREATE TABLE IF NOT EXISTS controle_mensalidade (
      id INTEGER PRIMARY KEY AUTOINCREMENT, mes INTEGER NOT NULL, ano INTEGER NOT NULL,
      valor_padrao REAL NOT NULL DEFAULT 40.00, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(mes, ano)
    );
    CREATE TABLE IF NOT EXISTS avisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, mensagem TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ Banco SQLite (local) conectado.");
  module.exports = Promise.resolve(dbLocal);
}