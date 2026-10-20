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

const totalJogadores = db.prepare("SELECT COUNT(*) AS total FROM jogadores").get();

if (totalJogadores.total === 0) {
  const nomeAdm = "Mario";
  const telefoneAdm = "43998665378";
  const senhaAdm = "hrjr128";

  const senhaHash = bcrypt.hashSync(senhaAdm, 10);

  db.prepare(`
    INSERT INTO jogadores (nome, telefone, senha, admin)
    VALUES (?, ?, ?, 1)
  `).run(nomeAdm, telefoneAdm, senhaHash);

  console.log("👑 Admin criado:");
  console.log("   Telefone:", telefoneAdm);
  console.log("   Senha:   ", senhaAdm);
}

// Cria um jogo inicial se não existir
const totalJogos = db.prepare("SELECT COUNT(*) AS total FROM jogos").get();

if (totalJogos.total === 0) {
  db.prepare(`
    INSERT INTO jogos (data, horario, local, minimo_jogadores)
    VALUES (?, ?, ?, ?)
  `).run("2026-10-21", "19:30", "Chácara", 14);

  console.log("⚽ Jogo inicial cadastrado.");
}

// =====================================================
// ROTAS DE AUTENTICAÇÃO
// =====================================================

// CADASTRO
app.post("/api/cadastro", async (req, res) => {
  const { nome, telefone, senha } = req.body;

  if (!nome || !telefone || !senha) {
    return res.status(400).json({
      erro: "Nome, telefone e senha são obrigatórios."
    });
  }

  const telefoneLimpo = String(telefone).replace(/\D/g, "");

  if (telefoneLimpo.length < 10) {
    return res.status(400).json({ erro: "Telefone inválido." });
  }

  const existe = db.prepare(
    "SELECT id FROM jogadores WHERE telefone = ?"
  ).get(telefoneLimpo);

  if (existe) {
    return res.status(400).json({
      erro: "Já existe um jogador com esse telefone."
    });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    const resultado = db.prepare(`
      INSERT INTO jogadores (nome, telefone, senha, admin)
      VALUES (?, ?, ?, 0)
    `).run(nome.trim(), telefoneLimpo, senhaHash);

    res.json({
      sucesso: true,
      jogador: {
        id: resultado.lastInsertRowid,
        nome: nome.trim(),
        telefone: telefoneLimpo,
        admin: false
      }
    });
  } catch (erro) {
    console.error("Erro no cadastro:", erro);
    res.status(500).json({ erro: "Não foi possível cadastrar." });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { telefone, senha } = req.body;

  if (!telefone || !senha) {
    return res.status(400).json({
      erro: "Telefone e senha são obrigatórios."
    });
  }

  const telefoneLimpo = String(telefone).replace(/\D/g, "");

  const jogador = db.prepare(`
    SELECT * FROM jogadores
    WHERE telefone = ? AND ativo = 1
  `).get(telefoneLimpo);

  if (!jogador) {
    return res.status(401).json({ erro: "Telefone ou senha incorretos." });
  }

  const senhaConfere = await bcrypt.compare(senha, jogador.senha);

  if (!senhaConfere) {
    return res.status(401).json({ erro: "Telefone ou senha incorretos." });
  }

  res.json({
    sucesso: true,
    jogador: {
      id: jogador.id,
      nome: jogador.nome,
      telefone: jogador.telefone,
      admin: jogador.admin === 1
    }
  });
});

// =====================================================
// ROTAS DO JOGO
// =====================================================

// Próximo jogo
app.get("/api/jogo", (req, res) => {
  const jogo = db.prepare(`
    SELECT * FROM jogos
    WHERE date(data) >= date('now', 'localtime')
    ORDER BY data ASC
    LIMIT 1
  `).get();

  if (!jogo) {
    return res.status(404).json({ erro: "Nenhum jogo futuro cadastrado." });
  }

  res.json(jogo);
});

// Próximos jogos (do segundo em diante)
app.get("/api/proximos-jogos", (req, res) => {
  const jogos = db.prepare(`
    SELECT * FROM jogos
    WHERE date(data) >= date('now', 'localtime')
    ORDER BY data ASC
  `).all();

  // Pula o primeiro (que já aparece como "próximo jogo")
  res.json(jogos.slice(1));
});

// =====================================================
// ROTAS DE JOGADORES
// =====================================================

app.get("/api/jogadores", (req, res) => {
  const jogo = db.prepare(`
    SELECT * FROM jogos
    WHERE date(data) >= date('now', 'localtime')
    ORDER BY data ASC
    LIMIT 1
  `).get();

  const jogadores = db.prepare(`
    SELECT
      j.id,
      j.nome,
      COALESCE(p.status, 'pendente') AS status
    FROM jogadores j
    LEFT JOIN presencas p
      ON p.jogador_id = j.id
      AND p.jogo_id = ?
    WHERE j.ativo = 1
    ORDER BY j.nome
  `).all(jogo ? jogo.id : null);

  res.json(jogadores);
});

// =====================================================
// ROTAS DE PRESENÇA
// =====================================================

app.post("/api/presenca", (req, res) => {
  const { jogadorId, status } = req.body;

  if (!["confirmado", "nao_vai"].includes(status)) {
    return res.status(400).json({ erro: "Status inválido." });
  }

  const jogador = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND ativo = 1"
  ).get(Number(jogadorId));

  if (!jogador) {
    return res.status(404).json({ erro: "Jogador não encontrado." });
  }

  const jogo = db.prepare(`
    SELECT * FROM jogos
    WHERE date(data) >= date('now', 'localtime')
    ORDER BY data ASC
    LIMIT 1
  `).get();

  if (!jogo) {
    return res.status(404).json({ erro: "Nenhum jogo futuro." });
  }

  db.prepare(`
    INSERT INTO presencas (jogador_id, jogo_id, status)
    VALUES (?, ?, ?)
    ON CONFLICT(jogador_id, jogo_id)
    DO UPDATE SET status = excluded.status,
                  atualizado_em = datetime('now')
  `).run(jogador.id, jogo.id, status);

  res.json({
    id: jogador.id,
    nome: jogador.nome,
    status
  });
});

// =====================================================
// ROTAS DE JOGOS (ADM)
// =====================================================
// LISTAR JOGOS FUTUROS (só admin)
app.get("/api/jogos/:jogadorId", (req, res) => {
  const jogador = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(req.params.jogadorId));

  if (!jogador) {
    return res.status(403).json({ erro: "Apenas admin pode ver a lista." });
  }

  const jogos = db.prepare(`
    SELECT * FROM jogos
    WHERE date(data) >= date('now', 'localtime')
    ORDER BY data ASC
  `).all();

  res.json(jogos);
});

// CRIAR JOGO (só admin)
app.post("/api/jogos", (req, res) => {
  const { jogadorId, data, horario, local, minimo_jogadores } = req.body;

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode criar jogos." });
  }

  if (!data || !horario || !local) {
    return res.status(400).json({
      erro: "Data, horário e local são obrigatórios."
    });
  }

  const hoje = new Date().toISOString().split("T")[0];
  if (data < hoje) {
    return res.status(400).json({
      erro: "A data do jogo não pode ser no passado."
    });
  }

  try {
    const resultado = db.prepare(`
      INSERT INTO jogos (data, horario, local, minimo_jogadores)
      VALUES (?, ?, ?, ?)
    `).run(
      data,
      horario,
      local.trim(),
      Number(minimo_jogadores) || 14
    );

    res.json({
      sucesso: true,
      id: resultado.lastInsertRowid
    });

  } catch (erro) {
    console.error("Erro ao criar jogo:", erro);
    res.status(500).json({ erro: "Não foi possível criar o jogo." });
  }
});

// CANCELAR JOGO (só admin)
app.delete("/api/jogos/:id", (req, res) => {
  const { jogadorId } = req.body;

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode cancelar jogos." });
  }

  const jogo = db.prepare("SELECT * FROM jogos WHERE id = ?").get(Number(req.params.id));

  if (!jogo) {
    return res.status(404).json({ erro: "Jogo não encontrado." });
  }

  db.prepare("DELETE FROM jogos WHERE id = ?").run(Number(req.params.id));

  res.json({ sucesso: true, mensagem: "Jogo cancelado." });
});
// =====================================================
// ROTAS DE MENSALIDADE
// =====================================================

// GERAR COBRANÇA DO MÊS (só admin, dispara quando ADM abre painel)
app.post("/api/admin/gerar-mes", (req, res) => {
  const { jogadorId } = req.body;

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode gerar cobranças." });
  }

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  // Verifica se já gerou esse mês
  const jaGerou = db.prepare(
    "SELECT * FROM controle_mensalidade WHERE mes = ? AND ano = ?"
  ).get(mesAtual, anoAtual);

  if (jaGerou) {
    return res.json({ sucesso: true, gerado: false, mensagem: "Mês já gerado." });
  }

  // Pega jogadores ativos cadastrados ANTES deste mês
  const jogadores = db.prepare(`
    SELECT * FROM jogadores
    WHERE ativo = 1
      AND (
        strftime('%Y', criado_em) < ?
        OR (strftime('%Y', criado_em) = ? AND strftime('%m', criado_em) < ?)
      )
  `).all(String(anoAtual), String(anoAtual), String(mesAtual).padStart(2, "0"));

  // Cria cobrança pra cada um
  const inserir = db.prepare(`
    INSERT INTO mensalidades (jogador_id, mes, ano, valor, status)
    VALUES (?, ?, ?, 40, 'pendente')
  `);

  const criarVarias = db.transaction((lista) => {
    for (const j of lista) {
      inserir.run(j.id, mesAtual, anoAtual);
    }
  });

  criarVarias(jogadores);

  // Registra que gerou este mês
  db.prepare(`
    INSERT INTO controle_mensalidade (mes, ano, valor_padrao)
    VALUES (?, ?, 40)
  `).run(mesAtual, anoAtual);

  res.json({
    sucesso: true,
    gerado: true,
    quantidade: jogadores.length,
    mes: mesAtual,
    ano: anoAtual
  });
});

// LISTAR MENSALIDADES DE UM JOGADOR (jogador vê as dele)
app.get("/api/mensalidades/:jogadorId", (req, res) => {
  const jogadorId = Number(req.params.jogadorId);

  const jogador = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND ativo = 1"
  ).get(jogadorId);

  if (!jogador) {
    return res.status(404).json({ erro: "Jogador não encontrado." });
  }

  const mensalidades = db.prepare(`
    SELECT * FROM mensalidades
    WHERE jogador_id = ?
    ORDER BY ano DESC, mes DESC
  `).all(jogadorId);

  // Calcula totais
  const pendentes = mensalidades.filter(m => m.status === "pendente");
  const totalDevido = pendentes.reduce((soma, m) => soma + m.valor, 0);

  res.json({
    jogador: { id: jogador.id, nome: jogador.nome },
    mensalidades,
    totalDevido,
    mesesPendentes: pendentes.length
  });
});

// LISTAR TODAS MENSALIDADES (só admin)
app.get("/api/admin/mensalidades/:adminId", (req, res) => {
  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(req.params.adminId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin." });
  }

  // Lista todos os jogadores com o total que devem
  const jogadores = db.prepare(`
    SELECT
      j.id,
      j.nome,
      j.telefone,
      j.ativo,
      COALESCE(SUM(CASE WHEN m.status = 'pendente' THEN m.valor ELSE 0 END), 0) AS total_devido,
      COUNT(CASE WHEN m.status = 'pendente' THEN 1 END) AS meses_pendentes
    FROM jogadores j
    LEFT JOIN mensalidades m ON m.jogador_id = j.id
    WHERE j.ativo = 1
    GROUP BY j.id
    ORDER BY total_devido DESC, j.nome ASC
  `).all();

  res.json(jogadores);
});

// DAR BAIXA EM UMA MENSALIDADE (só admin)
app.put("/api/mensalidades/:id/pagar", (req, res) => {
  const { jogadorId } = req.body;
  const mensalidadeId = Number(req.params.id);

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode dar baixa." });
  }

  const mensalidade = db.prepare(
    "SELECT * FROM mensalidades WHERE id = ?"
  ).get(mensalidadeId);

  if (!mensalidade) {
    return res.status(404).json({ erro: "Mensalidade não encontrada." });
  }

  if (mensalidade.status === "pago") {
    return res.status(400).json({ erro: "Essa mensalidade já está paga." });
  }

  db.prepare(`
    UPDATE mensalidades
    SET status = 'pago',
        data_pagamento = datetime('now')
    WHERE id = ?
  `).run(mensalidadeId);

  res.json({ sucesso: true, mensagem: "Mensalidade quitada!" });
});

// VER DETALHES DAS MENSALIDADES DE UM JOGADOR (só admin)
app.get("/api/admin/mensalidades/:adminId/jogador/:jogadorId", (req, res) => {
  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(req.params.adminId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin." });
  }

  const jogador = db.prepare(
    "SELECT id, nome, telefone FROM jogadores WHERE id = ?"
  ).get(Number(req.params.jogadorId));

  if (!jogador) {
    return res.status(404).json({ erro: "Jogador não encontrado." });
  }

  const mensalidades = db.prepare(`
    SELECT * FROM mensalidades
    WHERE jogador_id = ?
    ORDER BY ano DESC, mes DESC
  `).all(Number(req.params.jogadorId));

  res.json({ jogador, mensalidades });
});
// =====================================================
// ROTAS DE AVISOS
// =====================================================

// LISTAR TODOS OS AVISOS (público — qualquer jogador logado pode ver)
app.get("/api/avisos", (req, res) => {
  const avisos = db.prepare(`
    SELECT * FROM avisos
    ORDER BY criado_em DESC
  `).all();

  res.json(avisos);
});

// CRIAR AVISO (só admin)
app.post("/api/avisos", (req, res) => {
  const { jogadorId, titulo, mensagem } = req.body;

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode publicar avisos." });
  }

  if (!titulo || !titulo.trim() || !mensagem || !mensagem.trim()) {
    return res.status(400).json({
      erro: "Título e mensagem são obrigatórios."
    });
  }

  try {
    const resultado = db.prepare(`
      INSERT INTO avisos (titulo, mensagem)
      VALUES (?, ?)
    `).run(titulo.trim(), mensagem.trim());

    res.json({
      sucesso: true,
      id: resultado.lastInsertRowid
    });

  } catch (erro) {
    console.error("Erro ao criar aviso:", erro);
    res.status(500).json({ erro: "Não foi possível publicar." });
  }
});

// EXCLUIR AVISO (só admin)
app.delete("/api/avisos/:id", (req, res) => {
  const { jogadorId } = req.body;
  const avisoId = Number(req.params.id);

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode excluir avisos." });
  }

  const aviso = db.prepare(
    "SELECT * FROM avisos WHERE id = ?"
  ).get(avisoId);

  if (!aviso) {
    return res.status(404).json({ erro: "Aviso não encontrado." });
  }

  db.prepare("DELETE FROM avisos WHERE id = ?").run(avisoId);

  res.json({ sucesso: true, mensagem: "Aviso excluído." });
});
// =====================================================
// ROTAS DE AVISOS
// =====================================================

// LISTAR TODOS OS AVISOS
app.get("/api/avisos", (req, res) => {
  const avisos = db.prepare(`
    SELECT * FROM avisos
    ORDER BY criado_em DESC
  `).all();

  res.json(avisos);
});

// CRIAR AVISO (só admin)
app.post("/api/avisos", (req, res) => {
  const { jogadorId, titulo, mensagem } = req.body;

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode publicar avisos." });
  }

  if (!titulo || !titulo.trim() || !mensagem || !mensagem.trim()) {
    return res.status(400).json({
      erro: "Título e mensagem são obrigatórios."
    });
  }

  try {
    const resultado = db.prepare(`
      INSERT INTO avisos (titulo, mensagem)
      VALUES (?, ?)
    `).run(titulo.trim(), mensagem.trim());

    res.json({
      sucesso: true,
      id: resultado.lastInsertRowid
    });

  } catch (erro) {
    console.error("Erro ao criar aviso:", erro);
    res.status(500).json({ erro: "Não foi possível publicar." });
  }
});

// EXCLUIR AVISO (só admin)
app.delete("/api/avisos/:id", (req, res) => {
  const { jogadorId } = req.body;
  const avisoId = Number(req.params.id);

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(jogadorId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin pode excluir avisos." });
  }

  const aviso = db.prepare(
    "SELECT * FROM avisos WHERE id = ?"
  ).get(avisoId);

  if (!aviso) {
    return res.status(404).json({ erro: "Aviso não encontrado." });
  }

  db.prepare("DELETE FROM avisos WHERE id = ?").run(avisoId);

  res.json({ sucesso: true, mensagem: "Aviso excluído." });
});

// =====================================================
// ADMIN: GERENCIAR JOGADORES
// =====================================================

// LISTAR TODOS JOGADORES (admin) - com contagem de mensalidades pendentes
app.get("/api/admin/jogadores/:adminId", (req, res) => {
  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(req.params.adminId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin." });
  }

  const jogadores = db.prepare(`
    SELECT
      j.id,
      j.nome,
      j.telefone,
      j.ativo,
      j.admin,
      j.time,
      j.criado_em,
      COALESCE(SUM(CASE WHEN m.status = 'pendente' THEN m.valor ELSE 0 END), 0) AS total_devido,
      COUNT(CASE WHEN m.status = 'pendente' THEN 1 END) AS meses_pendentes
    FROM jogadores j
    LEFT JOIN mensalidades m ON m.jogador_id = j.id
    GROUP BY j.id
    ORDER BY j.ativo DESC, j.nome ASC
  `).all();

  res.json(jogadores);
});

// CRIAR JOGADOR PELO ADMIN
app.post("/api/admin/jogadores", async (req, res) => {
  const { adminId, nome, telefone, senha } = req.body;

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(adminId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin." });
  }

  if (!nome || !nome.trim() || !telefone || !senha) {
    return res.status(400).json({
      erro: "Nome, telefone e senha são obrigatórios."
    });
  }

  const telefoneLimpo = String(telefone).replace(/\D/g, "");

  if (telefoneLimpo.length < 10) {
    return res.status(400).json({ erro: "Telefone inválido." });
  }

  const existe = db.prepare(
    "SELECT id FROM jogadores WHERE telefone = ?"
  ).get(telefoneLimpo);

  if (existe) {
    return res.status(400).json({
      erro: "Já existe um jogador com esse telefone."
    });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    const resultado = db.prepare(`
      INSERT INTO jogadores (nome, telefone, senha, admin)
      VALUES (?, ?, ?, 0)
    `).run(nome.trim(), telefoneLimpo, senhaHash);

    res.json({
      sucesso: true,
      id: resultado.lastInsertRowid
    });

  } catch (erro) {
    console.error("Erro ao cadastrar:", erro);
    res.status(500).json({ erro: "Não foi possível cadastrar." });
  }
});

// EDITAR JOGADOR PELO ADMIN (nome, telefone, senha opcional)
app.put("/api/admin/jogadores/:id", async (req, res) => {
  const { adminId, nome, telefone, senha } = req.body;
  const jogadorId = Number(req.params.id);

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(adminId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin." });
  }

  const jogador = db.prepare(
    "SELECT * FROM jogadores WHERE id = ?"
  ).get(jogadorId);

  if (!jogador) {
    return res.status(404).json({ erro: "Jogador não encontrado." });
  }

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: "Nome é obrigatório." });
  }

  const telefoneLimpo = String(telefone || "").replace(/\D/g, "");

  // Se telefone mudou, verifica se não tá duplicado
  if (telefoneLimpo && telefoneLimpo !== jogador.telefone) {
    const existe = db.prepare(
      "SELECT id FROM jogadores WHERE telefone = ? AND id != ?"
    ).get(telefoneLimpo, jogadorId);

    if (existe) {
      return res.status(400).json({
        erro: "Já existe outro jogador com esse telefone."
      });
    }
  }

  try {
    if (senha && senha.trim()) {
      // Atualiza com nova senha
      const senhaHash = await bcrypt.hash(senha, 10);
      db.prepare(`
        UPDATE jogadores
        SET nome = ?, telefone = ?, senha = ?
        WHERE id = ?
      `).run(nome.trim(), telefoneLimpo || jogador.telefone, senhaHash, jogadorId);
    } else {
      // Mantém a senha antiga
      db.prepare(`
        UPDATE jogadores
        SET nome = ?, telefone = ?
        WHERE id = ?
      `).run(nome.trim(), telefoneLimpo || jogador.telefone, jogadorId);
    }

    res.json({ sucesso: true, mensagem: "Jogador atualizado." });

  } catch (erro) {
    console.error("Erro ao editar:", erro);
    res.status(500).json({ erro: "Não foi possível atualizar." });
  }
});

// ATIVAR / DESATIVAR JOGADOR
app.put("/api/admin/jogadores/:id/ativo", (req, res) => {
  const { adminId, ativo } = req.body;
  const jogadorId = Number(req.params.id);

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(adminId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin." });
  }

  if (jogadorId === Number(adminId)) {
    return res.status(400).json({
      erro: "Você não pode desativar sua própria conta."
    });
  }

  const jogador = db.prepare(
    "SELECT * FROM jogadores WHERE id = ?"
  ).get(jogadorId);

  if (!jogador) {
    return res.status(404).json({ erro: "Jogador não encontrado." });
  }

  db.prepare(`
    UPDATE jogadores SET ativo = ? WHERE id = ?
  `).run(ativo ? 1 : 0, jogadorId);

  res.json({
    sucesso: true,
    ativo: !!ativo,
    mensagem: ativo ? "Jogador reativado." : "Jogador desativado."
  });
});
// LISTAR JOGOS PASSADOS (só admin - para lançar resultado)
app.get("/api/admin/jogos-passados/:adminId", (req, res) => {
  const admin = db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(req.params.adminId));
  if (!admin) return res.status(403).json({ erro: "Apenas admin." });

  const jogos = db.prepare(`
    SELECT * FROM jogos
    WHERE date(data) < date('now', 'localtime')
    ORDER BY data DESC
  `).all();

  res.json(jogos);
});

// SALVAR RESULTADO (só admin)
app.put("/api/admin/jogos/:id/resultado", (req, res) => {
  const { adminId, gols_time_a, gols_time_b } = req.body;
  const jogoId = Number(req.params.id);

  const admin = db.prepare("SELECT * FROM jogadores WHERE id = ? AND admin = 1").get(Number(adminId));
  if (!admin) return res.status(403).json({ erro: "Apenas admin." });

  db.prepare(`
    UPDATE jogos SET gols_time_a = ?, gols_time_b = ? WHERE id = ?
  `).run(Number(gols_time_a), Number(gols_time_b), jogoId);

  res.json({ sucesso: true });
});

// LISTAR ÚLTIMOS 5 RESULTADOS (público - para os usuários)
app.get("/api/resultados", (req, res) => {  // 👈 MUDOU AQUI
  const jogos = db.prepare(`
    SELECT * FROM jogos
    WHERE gols_time_a IS NOT NULL AND gols_time_b IS NOT NULL
    ORDER BY data DESC
    LIMIT 5
  `).all();

  res.json(jogos);
});
// =====================================================
// ROTAS DE TIMES (ESCALAÇÃO)
// =====================================================

// VER ESCALAÇÃO (público - todos os usuários podem ver)
app.get("/api/times", (req, res) => {
  const jogadores = db.prepare(`
    SELECT id, nome, time FROM jogadores
    WHERE ativo = 1
    ORDER BY nome ASC
  `).all();

  const timeA = jogadores.filter(j => j.time === "A");
  const timeB = jogadores.filter(j => j.time === "B");
  const aguardando = jogadores.filter(j => !j.time);

  res.json({ timeA, timeB, aguardando });
});

// DEFINIR TIME DE UM JOGADOR (só admin)
app.put("/api/admin/jogadores/:id/time", (req, res) => {
  const { adminId, time } = req.body;
  const jogadorId = Number(req.params.id);

  const admin = db.prepare(
    "SELECT * FROM jogadores WHERE id = ? AND admin = 1"
  ).get(Number(adminId));

  if (!admin) {
    return res.status(403).json({ erro: "Apenas admin." });
  }

  if (time !== "A" && time !== "B" && time !== null) {
    return res.status(400).json({ erro: "Time inválido. Use 'A', 'B' ou null." });
  }

  db.prepare(`
    UPDATE jogadores SET time = ? WHERE id = ?
  `).run(time, jogadorId);

  res.json({ sucesso: true, time });
});

// =====================================================
// TROCAR SENHA (qualquer jogador logado pode trocar a sua)
// =====================================================

app.put("/api/trocar-senha", async (req, res) => {
  const { jogadorId, senhaAtual, senhaNova } = req.body;

  if (!jogadorId || !senhaAtual || !senhaNova) {
    return res.status(400).json({ erro: "Preencha todos os campos." });
  }

  if (senhaNova.length < 4) {
    return res.status(400).json({ erro: "A nova senha deve ter pelo menos 4 caracteres." });
  }

  try {
    const jogador = db.prepare(
      "SELECT * FROM jogadores WHERE id = ? AND ativo = 1"
    ).get(Number(jogadorId));

    if (!jogador) {
      return res.status(404).json({ erro: "Jogador não encontrado." });
    }

    const senhaConfere = await bcrypt.compare(senhaAtual, jogador.senha);

    if (!senhaConfere) {
      return res.status(401).json({ erro: "Senha atual incorreta." });
    }

    const senhaHash = await bcrypt.hash(senhaNova, 10);

    db.prepare(`
      UPDATE jogadores SET senha = ? WHERE id = ?
    `).run(senhaHash, Number(jogadorId));

    res.json({ sucesso: true, mensagem: "Senha alterada com sucesso!" });

  } catch (erro) {
    console.error("Erro ao trocar senha:", erro);
    res.status(500).json({ erro: "Não foi possível alterar a senha." });
  }
});
// 🚨 ROTA TEMPORÁRIA DE EMERGÊNCIA
app.get("/api/emergencia-corrigir-admins", async (req, res) => {
  try {
    // 1. Remove a flag de admin de TODO MUNDO
    db.prepare("UPDATE jogadores SET admin = 0").run();

    // 2. Define o Eduardo como admin (pelo telefone dele)
    db.prepare("UPDATE jogadores SET admin = 1 WHERE telefone = '43998665378'").run();
    // ⚠️ IMPORTANTE: troca '43998665378' pelo telefone REAL do Eduardo

    res.send("Admins corrigidos! Apenas o Eduardo é admin agora.");
  } catch (erro) {
    res.status(500).send("Erro: " + erro.message);
  }
});
// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});