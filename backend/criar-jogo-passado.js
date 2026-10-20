const db = require("./database");

// Cria um jogo no passado (18/10/2026)
const resultado = db.prepare(`
  INSERT INTO jogos (data, horario, local, minimo_jogadores)
  VALUES ('2026-10-18', '19:30', 'Chácara', 14)
`).run();

console.log(`✅ Jogo passado criado! ID: ${resultado.lastInsertRowid}`);

// Mostra os jogos no banco
const jogos = db.prepare("SELECT id, data, gols_time_a, gols_time_b FROM jogos").all();
console.log(jogos);