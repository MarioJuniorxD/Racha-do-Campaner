// backend/server.js
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// =====================================================
// SEED — cria o primeiro ADM se o banco estiver vazio
// =====================================================
async function verificarSeed() {
  try {
    const totalJogadores = await db.prepare("SELECT COUNT(*) AS total FROM jogadores").get();
    if (Number(totalJogadores.total) === 0) {
      const nomeAdm = "Eduardo Campaner"; // <-- MUDE AQUI
      const telefoneAdm = "43999999999";  // <-- MUDE AQUI
      const senhaAdm = "admin123";        // <-- MUDE AQUI
      
      const senhaHash = await bcrypt.hash(senhaAdm, 10);
      await db.prepare("INSERT INTO jogadores (nome, telefone, senha, admin) VALUES (?, ?, ?, 1)").run(nomeAdm, telefoneAdm, senhaHash);
      console.log("👑 Admin criado:", telefoneAdm);
    }

    const totalJogos = await db.prepare("SELECT COUNT(*) AS total FROM jogos").get();
    if (Number(totalJogos.total) === 0) {
      await db.prepare("INSERT INTO jogos (data, horario, local, minimo_jogadores) VALUES (?, ?, ?, ?)").run("2026-10-21", "19:30", "Chácara", 14);
      console.log("⚽ Jogo inicial cadastrado.");
    }
  } catch (err) {
    console.error("Erro no seed:", err);
  }
}
verificarSeed();

// =====================================================
// ROTAS DE AUTENTICAÇÃO
// =====================================================
app.post("/api/cadastro", async (req, res) => {
  const { nome, telefone, senha } = req.body;
  if (!nome || !telefone || !senha) return res.status(400).json({ erro: "Nome, telefone e senha são obrigatórios." });

  const telefoneLimpo = String(telefone).replace(/\D/g, "");
  if (telefoneLimpo.length < 10) return res.status(400).json({ erro: "Telefone inválido." });

  try {
    const existe = await db.prepare("SELECT id FROM jogadores WHERE telefone = ?").get(telefoneLimpo);
    if (existe) return res.status(400).json({ erro: "Já existe um jogador com esse telefone." });

    const senhaHash = await bcrypt.hash(senha, 10);
    const resultado = await db.prepare("INSERT INTO jogadores (nome, telefone, senha, admin) VALUES (?, ?, ?, 0) RETURNING id").run(nome.trim(), telefoneLimpo, senhaHash);

    res.json({ sucesso: true, jogador: { id: resultado.lastInsertRowid, nome: nome.trim(), telefone: telefoneLimpo, admin: false } });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível cadastrar." });
  }
});

app.post("/api/login", async (req, res) => {
  const { telefone, senha } = req.body;
  if (!telefone || !senha) return res.status(400).json({ erro: "Telefone e senha são obrigatórios." });

  const telefoneLimpo = String(telefone).replace(/\D/g, "");
  try {
    const jogador = await db.prepare("SELECT * FROM jogadores WHERE telefone = ? AND ativo = 1").get(telefoneLimpo);
    if (!jogador) return res.status(401).json({ erro: "Telefone ou senha incorretos." });

    const senhaConfere = await bcrypt.compare(senha, jogador.senha);
    if (!senhaConfere) return res.status(401).json({ erro: "Telefone ou senha incorretos." });

    res.json({ sucesso: true, jogador: { id: jogador.id, nome: jogador.nome, telefone: jogador.telefone, admin: jogador.admin === 1 } });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro no servidor." });
  }
});

app.put("/api/trocar-senha", async (req, res) => {
  const { jogadorId, senhaAtual, senhaNova } = req.body;
  if (!jogadorId || !senhaAtual || !senhaNova) return res.status(400).json({ erro: "Preencha todos os campos." });
  if (senhaNova.length < 4) return res.status(400).json({ erro: "A nova senha deve ter pelo menos 4 caracteres." });

  try {
    const jogador = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND ativo = 1").get(Number(jogadorId));
    if (!jogador) return res.status(404).json({ erro: "Jogador não encontrado." });

    const senhaConfere = await bcrypt.compare(senhaAtual, jogador.senha);
    if (!senhaConfere) return res.status(401).json({ erro: "Senha atual incorreta." });

    const senhaHash = await bcrypt.hash(senhaNova, 10);
    await db.prepare("UPDATE jogadores SET senha = ? WHERE id = ?").run(senhaHash, Number(jogadorId));
    res.json({ sucesso: true, mensagem: "Senha alterada com sucesso!" });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Não foi possível alterar a senha." });
  }
});

// =====================================================
// ROTAS DO JOGO
// =====================================================
app.get("/api/jogo", async (req, res) => {
  try {
    const jogo = await db.prepare("SELECT * FROM jogos WHERE date(data) >= date('now', 'localtime') ORDER BY data ASC LIMIT 1").get();
    if (!jogo) return res.status(404).json({ erro: "Nenhum jogo futuro." });
    res.json(jogo);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.get("/api/proximos-jogos", async (req, res) => {
  try {
    const jogos = await db.prepare("SELECT * FROM jogos WHERE date(data) >= date('now', 'localtime') ORDER BY data ASC").all();
    res.json(jogos.slice(1));
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

// =====================================================
// ROTAS DE JOGADORES E PRESENÇA
// =====================================================
app.get("/api/jogadores", async (req, res) => {
  try {
    const jogo = await db.prepare("SELECT * FROM jogos WHERE date(data) >= date('now', 'localtime') ORDER BY data ASC LIMIT 1").get();
    const jogadores = await db.prepare(`
      SELECT j.id, j.nome, COALESCE(p.status, 'pendente') AS status
      FROM jogadores j LEFT JOIN presencas p ON p.jogador_id = j.id AND p.jogo_id = ?
      WHERE j.ativo = 1 ORDER BY j.nome
    `).all(jogo ? jogo.id : null);
    res.json(jogadores);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.post("/api/presenca", async (req, res) => {
  const { jogadorId, status } = req.body;
  if (!["confirmado", "nao_vai"].includes(status)) return res.status(400).json({ erro: "Status inválido." });

  try {
    const jogador = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND ativo = 1").get(Number(jogadorId));
    if (!jogador) return res.status(404).json({ erro: "Jogador não encontrado." });

    const jogo = await db.prepare("SELECT * FROM jogos WHERE date(data) >= date('now', 'localtime') ORDER BY data ASC LIMIT 1").get();
    if (!jogo) return res.status(404).json({ erro: "Nenhum jogo futuro." });

    // Postgres usa ON CONFLICT igual o SQLite
    await db.prepare(`
      INSERT INTO presencas (jogador_id, jogo_id, status) VALUES (?, ?, ?)
      ON CONFLICT(jogador_id, jogo_id) DO UPDATE SET status = excluded.status, atualizado_em = CURRENT_TIMESTAMP
    `).run(jogador.id, jogo.id, status);

    res.json({ id: jogador.id, nome: jogador.nome, status });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

// =====================================================
// ADMIN: JOGOS
// =====================================================
app.post("/api/jogos", async (req, res) => {
  const { jogadorId, data, horario, local, minimo_jogadores } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(jogadorId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    if (!data || !horario || !local) return res.status(400).json({ erro: "Dados incompletos." });

    await db.prepare("INSERT INTO jogos (data, horario, local, minimo_jogadores) VALUES (?, ?, ?, ?)").run(data, horario, local.trim(), Number(minimo_jogadores) || 14);
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro ao criar." }); }
});

app.get("/api/jogos/:jogadorId", async (req, res) => {
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(req.params.jogadorId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    const jogos = await db.prepare("SELECT * FROM jogos WHERE date(data) >= date('now', 'localtime') ORDER BY data ASC").all();
    res.json(jogos);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.delete("/api/jogos/:id", async (req, res) => {
  const { jogadorId } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(jogadorId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    await db.prepare("DELETE FROM jogos WHERE id = ?").run(Number(req.params.id));
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

// =====================================================
// ADMIN: RESULTADOS
// =====================================================
app.get("/api/admin/jogos-passados/:adminId", async (req, res) => {
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(req.params.adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    const jogos = await db.prepare("SELECT * FROM jogos WHERE date(data) < date('now', 'localtime') ORDER BY data DESC").all();
    res.json(jogos);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.put("/api/admin/jogos/:id/resultado", async (req, res) => {
  const { adminId, gols_time_a, gols_time_b } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    await db.prepare("UPDATE jogos SET gols_time_a = ?, gols_time_b = ? WHERE id = ?").run(Number(gols_time_a), Number(gols_time_b), Number(req.params.id));
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.get("/api/resultados", async (req, res) => {
  try {
    const jogos = await db.prepare("SELECT * FROM jogos WHERE gols_time_a IS NOT NULL AND gols_time_b IS NOT NULL ORDER BY data DESC LIMIT 5").all();
    res.json(jogos);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

// =====================================================
// ADMIN: GERENCIAR JOGADORES E TIMES
// =====================================================
app.get("/api/admin/jogadores/:adminId", async (req, res) => {
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(req.params.adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    
    const jogadores = await db.prepare(`
      SELECT j.id, j.nome, j.telefone, j.ativo, j.admin, j.time, j.criado_em,
      COALESCE(SUM(CASE WHEN m.status = 'pendente' THEN m.valor ELSE 0 END), 0) AS total_devido,
      COUNT(CASE WHEN m.status = 'pendente' THEN 1 END) AS meses_pendentes
      FROM jogadores j LEFT JOIN mensalidades m ON m.jogador_id = j.id
      GROUP BY j.id, j.nome, j.telefone, j.ativo, j.admin, j.time, j.criado_em
      ORDER BY j.ativo DESC, j.nome ASC
    `).all();
    res.json(jogadores);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.post("/api/admin/jogadores", async (req, res) => {
  const { adminId, nome, telefone, senha } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    
    const telefoneLimpo = String(telefone).replace(/\D/g, "");
    const senhaHash = await bcrypt.hash(senha, 10);
    
    await db.prepare("INSERT INTO jogadores (nome, telefone, senha, admin) VALUES (?, ?, ?, 0)").run(nome.trim(), telefoneLimpo, senhaHash);
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.put("/api/admin/jogadores/:id", async (req, res) => {
  const { adminId, nome, telefone, senha } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    
    const telefoneLimpo = String(telefone).replace(/\D/g, "");
    if (senha && senha.trim() !== "") {
      const senhaHash = await bcrypt.hash(senha, 10);
      await db.prepare("UPDATE jogadores SET nome = ?, telefone = ?, senha = ? WHERE id = ?").run(nome.trim(), telefoneLimpo, senhaHash, Number(req.params.id));
    } else {
      await db.prepare("UPDATE jogadores SET nome = ?, telefone = ? WHERE id = ?").run(nome.trim(), telefoneLimpo, Number(req.params.id));
    }
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.put("/api/admin/jogadores/:id/ativo", async (req, res) => {
  const { adminId, ativo } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    await db.prepare("UPDATE jogadores SET ativo = ? WHERE id = ?").run(ativo ? 1 : 0, Number(req.params.id));
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.put("/api/admin/jogadores/:id/time", async (req, res) => {
  const { adminId, time } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    await db.prepare("UPDATE jogadores SET time = ? WHERE id = ?").run(time, Number(req.params.id));
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.get("/api/times", async (req, res) => {
  try {
    const jogadores = await db.prepare("SELECT id, nome, time FROM jogadores WHERE ativo = 1 ORDER BY nome ASC").all();
    res.json({
      timeA: jogadores.filter(j => j.time === "A"),
      timeB: jogadores.filter(j => j.time === "B"),
      aguardando: jogadores.filter(j => !j.time)
    });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

// =====================================================
// AVISOS
// =====================================================
app.get("/api/avisos", async (req, res) => {
  try {
    const avisos = await db.prepare("SELECT * FROM avisos ORDER BY criado_em DESC").all();
    res.json(avisos);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.post("/api/avisos", async (req, res) => {
  const { jogadorId, titulo, mensagem } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(jogadorId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    await db.prepare("INSERT INTO avisos (titulo, mensagem) VALUES (?, ?)").run(titulo.trim(), mensagem.trim());
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.delete("/api/avisos/:id", async (req, res) => {
  const { jogadorId } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(jogadorId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    await db.prepare("DELETE FROM avisos WHERE id = ?").run(Number(req.params.id));
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

// =====================================================
// MENSALIDADES
// =====================================================
app.post("/api/admin/gerar-mes", async (req, res) => {
  const { jogadorId } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(jogadorId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });

    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    const jaGerou = await db.prepare("SELECT * FROM controle_mensalidade WHERE mes = ? AND ano = ?").get(mesAtual, anoAtual);
    if (jaGerou) return res.json({ sucesso: true, gerado: false });

    const jogadores = await db.prepare(`
      SELECT * FROM jogadores WHERE ativo = 1 
      AND (strftime('%Y', criado_em) < ? OR (strftime('%Y', criado_em) = ? AND strftime('%m', criado_em) < ?))
    `).all(String(anoAtual), String(anoAtual), String(mesAtual).padStart(2, "0"));

    for (let j of jogadores) {
      await db.prepare("INSERT INTO mensalidades (jogador_id, mes, ano, valor, status) VALUES (?, ?, ?, 40, 'pendente')").run(j.id, mesAtual, anoAtual);
    }
    await db.prepare("INSERT INTO controle_mensalidade (mes, ano, valor_padrao) VALUES (?, ?, 40)").run(mesAtual, anoAtual);

    res.json({ sucesso: true, gerado: true, quantidade: jogadores.length, mes: mesAtual, ano: anoAtual });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.get("/api/mensalidades/:jogadorId", async (req, res) => {
  try {
    const jogador = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND ativo = 1").get(Number(req.params.jogadorId));
    if (!jogador) return res.status(404).json({ erro: "Jogador não encontrado." });

    const mensalidades = await db.prepare("SELECT * FROM mensalidades WHERE jogador_id = ? ORDER BY ano DESC, mes DESC").all(Number(req.params.jogadorId));
    const pendentes = mensalidades.filter(m => m.status === "pendente");
    
    res.json({
      jogador: { id: jogador.id, nome: jogador.nome },
      mensalidades, totalDevido: pendentes.reduce((s, m) => s + m.valor, 0),
      mesesPendentes: pendentes.length
    });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.get("/api/admin/mensalidades/:adminId", async (req, res) => {
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(req.params.adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });

    const jogadores = await db.prepare(`
      SELECT j.id, j.nome, j.telefone, j.ativo,
      COALESCE(SUM(CASE WHEN m.status = 'pendente' THEN m.valor ELSE 0 END), 0) AS total_devido,
      COUNT(CASE WHEN m.status = 'pendente' THEN 1 END) AS meses_pendentes
      FROM jogadores j LEFT JOIN mensalidades m ON m.jogador_id = j.id
      WHERE j.ativo = 1 GROUP BY j.id, j.nome, j.telefone, j.ativo ORDER BY total_devido DESC, j.nome ASC
    `).all();
    res.json(jogadores);
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.get("/api/admin/mensalidades/:adminId/jogador/:jogadorId", async (req, res) => {
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(req.params.adminId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });

    const jogador = await db.prepare("SELECT id, nome, telefone FROM jogadores WHERE id = ?").get(Number(req.params.jogadorId));
    const mensalidades = await db.prepare("SELECT * FROM mensalidades WHERE jogador_id = ? ORDER BY ano DESC, mes DESC").all(Number(req.params.jogadorId));
    res.json({ jogador, mensalidades });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.put("/api/mensalidades/:id/pagar", async (req, res) => {
  const { jogadorId } = req.body;
  try {
    const admin = await db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(jogadorId));
    if (!admin) return res.status(403).json({ erro: "Apenas admin." });
    await db.prepare("UPDATE mensalidades SET status = 'pago', data_pagamento = CURRENT_TIMESTAMP WHERE id = ?").run(Number(req.params.id));
    res.json({ sucesso: true });
  } catch (erro) { res.status(500).json({ erro: "Erro." }); }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});