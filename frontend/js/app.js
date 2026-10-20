// =====================================================
// SESSÃO (login salvo no navegador)
// =====================================================

const CHAVE_SESSAO = "racha_sessao";

function salvarSessao(jogador) {
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(jogador));
}

function lerSessao() {
  try {
    const json = localStorage.getItem(CHAVE_SESSAO);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    return null;
  }
}

function limparSessao() {
  localStorage.removeItem(CHAVE_SESSAO);
}

// =====================================================
// TROCA DE TELAS
// =====================================================

function mostrarTela(idTela) {
  document.querySelectorAll(".tela").forEach(t => {
    t.style.display = "none";
  });

  const tela = document.getElementById(idTela);
  if (tela) tela.style.display = "flex";
}

function mostrarLogin() {
  mostrarTela("telaLogin");
  const campo = document.getElementById("loginTelefone");
  if (campo) campo.focus();
}

function mostrarCadastro() {
  mostrarTela("telaCadastro");
  const campo = document.getElementById("cadNome");
  if (campo) campo.focus();
}

function mostrarApp() {
  mostrarTela("telaApp");

  const jogador = lerSessao();
  if (jogador) {
    const elNome = document.getElementById("nomeUsuarioLogado");
    if (elNome) elNome.textContent = jogador.nome;

    const btnAdm = document.getElementById("btnAdm");
    if (btnAdm) {
      btnAdm.style.display = jogador.admin ? "inline-block" : "none";
    }
  }

  carregarJogo();
  carregarJogadores();
  carregarProximosJogos();
  verificarMensalidadePendente();
}

// =====================================================
// LOGIN E CADASTRO
// =====================================================

async function fazerLogin() {
  const telefone = document.getElementById("loginTelefone").value.trim();
  const senha = document.getElementById("loginSenha").value;
  const msg = document.getElementById("mensagemLogin");

  msg.textContent = "";

  if (!telefone || !senha) {
    msg.textContent = "Preencha telefone e senha.";
    return;
  }

  try {
    const resposta = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      msg.textContent = dados.erro || "Erro ao entrar.";
      return;
    }

    salvarSessao(dados.jogador);
    document.getElementById("loginSenha").value = "";
    mostrarApp();
  } catch (erro) {
    console.error(erro);
    msg.textContent = "Não foi possível conectar ao servidor.";
  }
}

async function fazerCadastro() {
  const nome = document.getElementById("cadNome").value.trim();
  const telefone = document.getElementById("cadTelefone").value.trim();
  const senha = document.getElementById("cadSenha").value;
  const msg = document.getElementById("mensagemCadastro");

  msg.textContent = "";

  if (!nome || !telefone || !senha) {
    msg.textContent = "Preencha todos os campos.";
    return;
  }

  try {
    const resposta = await fetch("/api/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, telefone, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      msg.textContent = dados.erro || "Erro ao cadastrar.";
      return;
    }

    salvarSessao(dados.jogador);
    mostrarApp();
  } catch (erro) {
    console.error(erro);
    msg.textContent = "Não foi possível conectar ao servidor.";
  }
}

function fazerLogout() {
  limparSessao();
  document.getElementById("loginTelefone").value = "";
  document.getElementById("loginSenha").value = "";
  mostrarLogin();
}

// =====================================================
// CARREGAR JOGOS E JOGADORES (TELA PRINCIPAL)
// =====================================================

function ehJogoExtra(dataISO) {
  const data = new Date(dataISO + "T12:00:00");
  return data.getDay() !== 3;
}

async function carregarJogo() {
  try {
    const resposta = await fetch("/api/jogo");
    const jogo = await resposta.json();

    if (!resposta.ok) {
      document.getElementById("jogo").innerHTML = `<p>${jogo.erro || "Nenhum jogo cadastrado."}</p>`;
      return;
    }

    const data = new Date(jogo.data + "T12:00:00");
    const dataFormatada = data.toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
    }).toUpperCase();

    const extra = ehJogoExtra(jogo.data);

    document.getElementById("jogo").innerHTML = `
      <p>📅 ${dataFormatada} ${extra ? '<span class="icone-extra">⚽❗</span>' : ''}</p>
      <p>🕐 ${jogo.horario}</p>
      <p>📍 ${jogo.local}</p>
    `;
  } catch (erro) {
    console.error(erro);
    document.getElementById("jogo").innerHTML = `<p>Erro ao carregar o jogo.</p>`;
  }
}

async function carregarProximosJogos() {
  const card = document.getElementById("cardProximosJogos");
  const container = document.getElementById("proximosJogos");

  if (!card || !container) return;

  try {
    const resposta = await fetch("/api/proximos-jogos");
    const jogos = await resposta.json();

    if (!resposta.ok || !jogos.length) {
      card.style.display = "none";
      return;
    }

    card.style.display = "block";

    container.innerHTML = jogos.map(j => {
      const data = new Date(j.data + "T12:00:00");
      const dataFormatada = data.toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
      }).toUpperCase();

      const extra = ehJogoExtra(j.data);

      return `
        <div class="proximo-jogo-item">
          <div class="proximo-data">
            📅 ${dataFormatada} ${extra ? '<span class="icone-extra">⚽❗</span>' : ''}
          </div>
          <div class="proximo-info">🕐 ${j.horario} · 📍 ${j.local}</div>
        </div>
      `;
    }).join("");
  } catch (erro) {
    console.error(erro);
    card.style.display = "none";
  }
}

async function carregarJogadores() {
  try {
    const resposta = await fetch("/api/jogadores");
    const jogadores = await resposta.json();
    const elemento = document.getElementById("jogadores");

    if (!jogadores.length) {
      elemento.innerHTML = "<p>Nenhum jogador cadastrado ainda.</p>";
      return;
    }

    elemento.innerHTML = jogadores.map(j => `
      <div class="jogador">
        <span>${j.nome}</span>
        <span>${j.status === "confirmado" ? "🟢 Confirmado" : j.status === "nao_vai" ? "🔴 Não vai" : "🟡 Pendente"}</span>
      </div>
    `).join("");
  } catch (erro) {
    console.error(erro);
    document.getElementById("jogadores").innerHTML = "<p>Erro ao carregar jogadores.</p>";
  }
}

async function registrarPresenca(status) {
  const jogador = lerSessao();
  if (!jogador) { mostrarLogin(); return; }

  try {
    const resposta = await fetch("/api/presenca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogadorId: jogador.id, status })
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      document.getElementById("mensagem").textContent = resultado.erro;
      return;
    }

    document.getElementById("mensagem").textContent = status === "confirmado" ? "Presença confirmada! ⚽" : "Presença registrada como ausência.";
    carregarJogadores();
  } catch (erro) {
    console.error(erro);
    document.getElementById("mensagem").textContent = "Não foi possível registrar a presença.";
  }
}

// =====================================================
// MINHA MENSALIDADE
// =====================================================

function abrirMensalidade() { mostrarTela("telaMensalidade"); carregarMensalidade(); }
function fecharMensalidade() { mostrarApp(); }

function nomeMes(mes) {
  const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return nomes[mes - 1] || "?";
}

async function carregarMensalidade() {
  const jogador = lerSessao();
  if (!jogador) { mostrarLogin(); return; }

  const resumo = document.getElementById("resumoConteudo");
  const historico = document.getElementById("historicoMensalidade");
  resumo.innerHTML = "<p>Carregando...</p>";
  historico.innerHTML = "<p>Carregando...</p>";

  try {
    const resposta = await fetch(`/api/mensalidades/${jogador.id}`);
    const dados = await resposta.json();

    if (!resposta.ok) {
      resumo.innerHTML = `<p>${dados.erro || "Erro ao carregar."}</p>`;
      historico.innerHTML = "";
      return;
    }

    if (dados.mesesPendentes === 0) {
      resumo.innerHTML = `<p class="resumo-valor em-dia">✅ Em dia!</p><p class="resumo-texto">Você não deve nada pra galera. 👏</p>`;
    } else {
      const total = dados.totalDevido.toFixed(2).replace(".", ",");
      resumo.innerHTML = `
        <p class="resumo-valor devendo">R$ ${total}</p>
        <p class="resumo-texto">${dados.mesesPendentes} ${dados.mesesPendentes === 1 ? "mês pendente" : "meses pendentes"}</p>
        <p class="resumo-texto">Fala com o ADM pra acertar. 😉</p>
      `;
    }

    if (!dados.mensalidades.length) {
      historico.innerHTML = `<p class="sem-mensalidade">📭 Nenhuma mensalidade registrada ainda.</p>`;
      return;
    }

    const ordenadas = [...dados.mensalidades].sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.mes - b.mes;
    });

    historico.innerHTML = ordenadas.map(m => {
      const pago = m.status === "pago";
      const valor = Number(m.valor).toFixed(2).replace(".", ",");
      return `
        <div class="mensalidade-item">
          <div>
            <div class="mensalidade-mes">📅 ${nomeMes(m.mes)}/${m.ano}</div>
            <div class="mensalidade-valor">R$ ${valor}</div>
          </div>
          <span class="mensalidade-status ${pago ? "pago" : "pendente"}">
            ${pago ? "✅ Pago" : "🔴 Pendente"}
          </span>
        </div>
      `;
    }).join("");
  } catch (erro) {
    console.error(erro);
    resumo.innerHTML = "<p>Erro ao conectar.</p>";
    historico.innerHTML = "";
  }
}

// =====================================================
// AVISO DE MENSALIDADE PENDENTE
// =====================================================

async function verificarMensalidadePendente() {
  const jogador = lerSessao();
  const aviso = document.getElementById("avisoMensalidade");
  if (!aviso) return;
  if (!jogador) { aviso.style.display = "none"; return; }

  try {
    const resposta = await fetch(`/api/mensalidades/${jogador.id}`);
    const dados = await resposta.json();

    if (!resposta.ok || !dados.mesesPendentes || dados.mesesPendentes === 0) {
      aviso.style.display = "none";
      return;
    }

    const titulo = document.getElementById("avisoPendenciaTitulo");
    const detalhe = document.getElementById("avisoPendenciaDetalhe");
    const meses = dados.mesesPendentes;
    const total = Number(dados.totalDevido).toFixed(2).replace(".", ",");

    titulo.textContent = `Você tem ${meses} ${meses === 1 ? "mensalidade" : "mensalidades"} pendente${meses === 1 ? "" : "s"}!`;
    detalhe.textContent = `Total: R$ ${total} — clique pra ver detalhes`;
    aviso.style.display = "flex";
  } catch (erro) {
    console.error(erro);
    aviso.style.display = "none";
  }
}

// =====================================================
// AVISOS (TODOS VEEM)
// =====================================================

function abrirAvisos() { mostrarTela("telaAvisos"); carregarAvisos(); }
function fecharAvisos() { mostrarApp(); }

function formatarDataHora(dataISO) {
  const data = new Date(dataISO + "Z");
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(texto) {
  return String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function carregarAvisos() {
  const container = document.getElementById("listaAvisos");
  container.innerHTML = "<p>Carregando...</p>";
  try {
    const resposta = await fetch("/api/avisos");
    const avisos = await resposta.json();

    if (!resposta.ok) { container.innerHTML = `<p class="sem-avisos">Erro ao carregar.</p>`; return; }
    if (!avisos.length) { container.innerHTML = `<div class="sem-avisos">📭 Nenhum aviso por enquanto.</div>`; return; }

    container.innerHTML = avisos.map(a => `
      <div class="aviso-card">
        <div class="aviso-titulo">${escapeHtml(a.titulo)}</div>
        <div class="aviso-data">🕐 ${formatarDataHora(a.criado_em)}</div>
        <div class="aviso-mensagem">${escapeHtml(a.mensagem)}</div>
      </div>
    `).join("");
  } catch (erro) {
    console.error(erro);
    container.innerHTML = `<p class="sem-avisos">Erro ao conectar.</p>`;
  }
}

// =====================================================
// RESULTADOS (USUÁRIO)
// =====================================================

function abrirResultados() { mostrarTela("telaResultados"); carregarResultados(); }
function fecharResultados() { mostrarApp(); }

async function carregarResultados() {
  const container = document.getElementById("listaResultados");
  container.innerHTML = "<p>Carregando...</p>";
  try {
    const res = await fetch("/api/resultados");
    const jogos = await res.json();
    
    if (!jogos.length) { container.innerHTML = "<p class='sem-avisos'>Nenhum resultado lançado ainda.</p>"; return; }
    
    container.innerHTML = jogos.map(j => `
      <div class="placar-card">
        <div class="placar-info">
          <div class="placar-data">📅 ${new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
          <div class="placar-placar">
            <span class="time-a">${j.gols_time_a}</span> 
            <span style="color:#888; font-size:18px;">x</span> 
            <span class="time-b">${j.gols_time_b}</span>
            <span style="font-size:14px; color:#666; font-weight:normal; margin-left:10px;">Time A vs Time B</span>
          </div>
        </div>
      </div>
    `).join("");
  } catch (e) { container.innerHTML = "<p>Erro.</p>"; }
}

// =====================================================
// ESCALAÇÃO (TODOS VEEM)
// =====================================================

function abrirEscalacao() { mostrarTela("telaEscalacao"); carregarEscalacao(); }
function fecharEscalacao() { mostrarApp(); }

async function carregarEscalacao() {
  const containerA = document.getElementById("listaTimeA");
  const containerB = document.getElementById("listaTimeB");
  const cardAguardando = document.getElementById("cardAguardando");
  const containerAguardando = document.getElementById("listaAguardando");

  containerA.innerHTML = "<p>Carregando...</p>";
  containerB.innerHTML = "<p>Carregando...</p>";

  try {
    const resposta = await fetch("/api/times");
    const dados = await resposta.json();

    const montarLista = (lista) => {
      if (!lista.length) return "<p class='sem-mensalidade'>Nenhum jogador ainda.</p>";
      return lista.map(j => `
        <div class="jogador-time-item">
          <span class="jogador-time-nome">👤 ${escapeHtml(j.nome)}</span>
        </div>
      `).join("");
    };

    containerA.innerHTML = montarLista(dados.timeA);
    containerB.innerHTML = montarLista(dados.timeB);

    if (dados.aguardando.length) {
      cardAguardando.style.display = "block";
      containerAguardando.innerHTML = dados.aguardando.map(j => `
        <div class="jogador-time-item">
          <span class="jogador-time-nome">⏳ ${escapeHtml(j.nome)}</span>
          <span class="tag-time tag-time-null">Aguardando</span>
        </div>
      `).join("");
    } else {
      cardAguardando.style.display = "none";
    }
  } catch (erro) {
    console.error(erro);
    containerA.innerHTML = "<p>Erro ao carregar.</p>";
    containerB.innerHTML = "<p>Erro ao carregar.</p>";
  }
}
// =====================================================
// TROCAR SENHA
// =====================================================

function abrirTrocarSenha() {
  mostrarTela("telaTrocarSenha");
  document.getElementById("senhaAtual").value = "";
  document.getElementById("senhaNova").value = "";
  document.getElementById("senhaNovaConfirma").value = "";
  document.getElementById("mensagemTrocarSenha").textContent = "";
}

function fecharTrocarSenha() {
  mostrarTela("telaAdm");
}

async function salvarNovaSenha() {
  const jogador = lerSessao();
  if (!jogador) { mostrarLogin(); return; }

  const senhaAtual = document.getElementById("senhaAtual").value;
  const senhaNova = document.getElementById("senhaNova").value;
  const senhaNovaConfirma = document.getElementById("senhaNovaConfirma").value;
  const msg = document.getElementById("mensagemTrocarSenha");

  msg.textContent = "";

  if (!senhaAtual || !senhaNova || !senhaNovaConfirma) {
    msg.textContent = "Preencha todos os campos.";
    return;
  }

  if (senhaNova.length < 4) {
    msg.textContent = "A nova senha deve ter pelo menos 4 caracteres.";
    return;
  }

  if (senhaNova !== senhaNovaConfirma) {
    msg.textContent = "As senhas novas não coincidem.";
    return;
  }

  try {
    const resposta = await fetch("/api/trocar-senha", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jogadorId: jogador.id,
        senhaAtual,
        senhaNova
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      msg.textContent = dados.erro || "Erro ao trocar senha.";
      return;
    }

    alert("Senha alterada com sucesso! 🔑");
    fecharTrocarSenha();

  } catch (erro) {
    console.error(erro);
    msg.textContent = "Erro ao conectar.";
  }
}

// =====================================================
// PAINEL DO ADM (INICIAL)
// =====================================================

function abrirPainelAdm() { mostrarTela("telaAdm"); }
function fecharPainelAdm() { mostrarApp(); }

// =====================================================
// ADMIN: CRIAR JOGO
// =====================================================

function calcularProximaQuarta() {
  const hoje = new Date();
  const diaDaSemana = hoje.getDay();
  let diasParaQuarta = (3 - diaDaSemana + 7) % 7;
  if (diasParaQuarta === 0) diasParaQuarta = 7;
  const proximaQuarta = new Date(hoje);
  proximaQuarta.setDate(hoje.getDate() + diasParaQuarta);
  return proximaQuarta;
}

function abrirCriarJogo() {
  const proximaQuarta = calcularProximaQuarta();
  const dataISO = proximaQuarta.toISOString().split("T")[0];
  document.getElementById("jogoData").value = dataISO;
  document.getElementById("mensagemCriarJogo").textContent = "";
  mostrarTela("telaCriarJogo");
}

function fecharCriarJogo() { mostrarTela("telaAdm"); }

async function salvarJogo() {
  const jogador = lerSessao();
  if (!jogador || !jogador.admin) { mostrarLogin(); return; }

  const data = document.getElementById("jogoData").value;
  const horario = document.getElementById("jogoHorario").value;
  const local = document.getElementById("jogoLocal").value.trim();
  const minimo_jogadores = document.getElementById("jogoMinimo").value;
  const msg = document.getElementById("mensagemCriarJogo");
  msg.textContent = "";

  if (!data || !horario || !local) { msg.textContent = "Preencha data, horário e local."; return; }

  try {
    const resposta = await fetch("/api/jogos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogadorId: jogador.id, data, horario, local, minimo_jogadores })
    });

    const resultado = await resposta.json();

    if (!resposta.ok) { msg.textContent = resultado.erro || "Erro ao criar jogo."; return; }

    alert("Jogo criado com sucesso! ⚽");
    mostrarTela("telaAdm");
  } catch (erro) {
    console.error(erro);
    msg.textContent = "Não foi possível conectar ao servidor.";
  }
}

// =====================================================
// ADMIN: LISTAR E CANCELAR JOGOS
// =====================================================

function abrirListarJogos() { mostrarTela("telaListarJogos"); carregarListaJogos(); }
function fecharListarJogos() { mostrarTela("telaAdm"); }

async function carregarListaJogos() {
  const jogador = lerSessao();
  if (!jogador || !jogador.admin) { mostrarLogin(); return; }

  const container = document.getElementById("listaJogos");
  container.innerHTML = "<p>Carregando...</p>";

  try {
    const resposta = await fetch(`/api/jogos/${jogador.id}`);
    const jogos = await resposta.json();

    if (!resposta.ok) { container.innerHTML = `<p class="jogos-vazio">${jogos.erro || "Erro."}</p>`; return; }
    if (!jogos.length) { container.innerHTML = `<div class="jogos-vazio"><p>📅 Nenhum jogo agendado no momento.</p></div>`; return; }

    container.innerHTML = jogos.map(j => {
      const data = new Date(j.data + "T12:00:00");
      const dataFormatada = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).toUpperCase();
      const extra = ehJogoExtra(j.data);

      return `
        <div class="jogo-card">
          <div class="linha">📅 ${dataFormatada} ${extra ? '<span class="icone-extra">⚽❗</span>' : ''}</div>
          <div class="linha">🕐 ${j.horario}</div>
          <div class="linha">📍 ${j.local}</div>
          <button class="btn-cancelar" onclick="cancelarJogo(${j.id})">🗑️ CANCELAR ESTE JOGO</button>
        </div>
      `;
    }).join("");
  } catch (erro) {
    console.error(erro);
    container.innerHTML = `<p class="jogos-vazio">Erro ao carregar jogos.</p>`;
  }
}

async function cancelarJogo(id) {
  const jogador = lerSessao();
  if (!jogador || !jogador.admin) { mostrarLogin(); return; }
  if (!confirm("Tem certeza que quer cancelar este jogo?")) return;

  try {
    const resposta = await fetch(`/api/jogos/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogadorId: jogador.id })
    });

    const resultado = await resposta.json();
    if (!resposta.ok) { alert(resultado.erro || "Erro."); return; }

    alert("Jogo cancelado! 🗑️");
    carregarListaJogos();
  } catch (erro) {
    console.error(erro);
    alert("Não foi possível conectar ao servidor.");
  }
}

// =====================================================
// ADMIN: MENSALIDADES
// =====================================================

function abrirAdminMensalidades() { mostrarTela("telaAdminMensalidades"); document.getElementById("mensagemGerarMes").textContent = ""; carregarListaAdminMensalidades(); }
function fecharAdminMensalidades() { mostrarTela("telaAdm"); }

async function gerarMesAtual() {
  const jogador = lerSessao();
  const msg = document.getElementById("mensagemGerarMes");
  const btn = document.getElementById("btnGerarMes");
  if (!jogador || !jogador.admin) return;

  msg.textContent = "";
  btn.disabled = true;
  btn.textContent = "⏳ Gerando...";

  try {
    const resposta = await fetch("/api/admin/gerar-mes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogadorId: jogador.id })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { msg.textContent = dados.erro || "Erro."; return; }

    if (dados.gerado) {
      msg.textContent = `✅ Criado ${dados.quantidade} ${dados.quantidade === 1 ? "cobrança" : "cobranças"} de ${nomeMes(dados.mes)}/${dados.ano}!`;
    } else {
      msg.textContent = `ℹ️ A cobrança de ${nomeMes(dados.mes || new Date().getMonth() + 1)} já foi gerada.`;
    }
    carregarListaAdminMensalidades();
  } catch (erro) {
    console.error(erro);
    msg.textContent = "Erro ao conectar.";
  } finally {
    btn.disabled = false;
    btn.textContent = "🔄 GERAR COBRANÇA DO MÊS";
  }
}

async function carregarListaAdminMensalidades() {
  const jogador = lerSessao();
  const container = document.getElementById("listaAdminMensalidades");
  if (!jogador || !jogador.admin) { mostrarLogin(); return; }

  container.innerHTML = "<p>Carregando...</p>";

  try {
    const resposta = await fetch(`/api/admin/mensalidades/${jogador.id}`);
    const lista = await resposta.json();
    if (!resposta.ok) { container.innerHTML = `<p>${lista.erro || "Erro."}</p>`; return; }
    if (!lista.length) { container.innerHTML = "<p class='sem-mensalidade'>Nenhum jogador cadastrado.</p>"; return; }

    container.innerHTML = lista.map(j => {
      const deve = j.total_devido > 0;
      const valorFmt = Number(j.total_devido).toFixed(2).replace(".", ",");
      const statusTexto = deve ? `🔴 ${j.meses_pendentes} ${j.meses_pendentes === 1 ? "mês pendente" : "meses pendentes"}` : "✅ Em dia";
      return `
        <div class="admin-jogador-item" onclick="abrirAdminDetalhe(${j.id})">
          <div class="admin-jogador-info">
            <div class="admin-jogador-nome">${j.nome}</div>
            <div class="admin-jogador-status">${statusTexto}</div>
          </div>
          <div class="admin-jogador-valor ${deve ? "devendo" : "em-dia"}">R$ ${valorFmt}</div>
        </div>
      `;
    }).join("");
  } catch (erro) {
    console.error(erro);
    container.innerHTML = "<p>Erro ao carregar.</p>";
  }
}

let _adminJogadorAtual = null;

async function abrirAdminDetalhe(jogadorId) {
  const admin = lerSessao();
  if (!admin || !admin.admin) return;

  _adminJogadorAtual = jogadorId;
  mostrarTela("telaAdminDetalhe");
  document.getElementById("adminDetalheNome").textContent = "Carregando...";
  document.getElementById("adminDetalheResumo").innerHTML = "<p>Carregando...</p>";
  document.getElementById("adminDetalheHistorico").innerHTML = "<p>Carregando...</p>";

  try {
    const resposta = await fetch(`/api/admin/mensalidades/${admin.id}/jogador/${jogadorId}`);
    const dados = await resposta.json();
    if (!resposta.ok) { document.getElementById("adminDetalheResumo").innerHTML = `<p>${dados.erro}</p>`; return; }

    document.getElementById("adminDetalheNome").textContent = `👤 ${dados.jogador.nome}`;

    const pendentes = dados.mensalidades.filter(m => m.status === "pendente");
    const totalDevido = pendentes.reduce((soma, m) => soma + m.valor, 0);
    const valorFmt = totalDevido.toFixed(2).replace(".", ",");

    if (pendentes.length === 0) {
      document.getElementById("adminDetalheResumo").innerHTML = `<p class="resumo-valor em-dia">✅ Em dia!</p><p class="resumo-texto">${dados.jogador.telefone || ""}</p>`;
    } else {
      document.getElementById("adminDetalheResumo").innerHTML = `
        <p class="resumo-valor devendo">R$ ${valorFmt}</p>
        <p class="resumo-texto">${pendentes.length} ${pendentes.length === 1 ? "mês pendente" : "meses pendentes"}</p>
        <p class="resumo-texto">${dados.jogador.telefone || ""}</p>
      `;
    }

    if (!dados.mensalidades.length) {
      document.getElementById("adminDetalheHistorico").innerHTML = `<p class="sem-mensalidade">📭 Nenhuma mensalidade registrada.</p>`;
      return;
    }

    const ordenadas = [...dados.mensalidades].sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes));

    document.getElementById("adminDetalheHistorico").innerHTML = ordenadas.map(m => {
      const pago = m.status === "pago";
      const valor = Number(m.valor).toFixed(2).replace(".", ",");
      return `
        <div class="mensalidade-item">
          <div>
            <div class="mensalidade-mes">📅 ${nomeMes(m.mes)}/${m.ano}</div>
            <div class="mensalidade-valor">R$ ${valor}</div>
          </div>
          <div>
            ${pago ? `<span class="mensalidade-status pago">✅ Pago</span>` : `<button class="btn-pagar" onclick="darBaixa(${m.id})">✅ DAR BAIXA</button>`}
          </div>
        </div>
      `;
    }).join("");
  } catch (erro) {
    console.error(erro);
    document.getElementById("adminDetalheResumo").innerHTML = "<p>Erro ao conectar.</p>";
  }
}

function fecharAdminDetalhe() { abrirAdminMensalidades(); }

async function darBaixa(mensalidadeId) {
  const admin = lerSessao();
  if (!admin || !admin.admin) return;
  if (!confirm("Confirmar que essa mensalidade foi paga?")) return;

  try {
    const resposta = await fetch(`/api/mensalidades/${mensalidadeId}/pagar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogadorId: admin.id })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { alert(dados.erro || "Erro."); return; }
    abrirAdminDetalhe(_adminJogadorAtual);
  } catch (erro) {
    console.error(erro);
    alert("Erro ao conectar.");
  }
}

// =====================================================
// ADMIN: AVISOS
// =====================================================

function abrirAdminAvisos() {
  mostrarTela("telaAdminAvisos");
  document.getElementById("avisoTitulo").value = "";
  document.getElementById("avisoMensagem").value = "";
  document.getElementById("mensagemAviso").textContent = "";
  carregarAdminAvisos();
}

function fecharAdminAvisos() { mostrarTela("telaAdm"); }

async function publicarAviso() {
  const jogador = lerSessao();
  if (!jogador || !jogador.admin) return;

  const titulo = document.getElementById("avisoTitulo").value.trim();
  const mensagem = document.getElementById("avisoMensagem").value.trim();
  const msg = document.getElementById("mensagemAviso");
  msg.textContent = "";

  if (!titulo || !mensagem) { msg.textContent = "Preencha título e mensagem."; return; }

  try {
    const resposta = await fetch("/api/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogadorId: jogador.id, titulo, mensagem })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { msg.textContent = dados.erro || "Erro ao publicar."; return; }

    alert("Aviso publicado! 📢");
    document.getElementById("avisoTitulo").value = "";
    document.getElementById("avisoMensagem").value = "";
    carregarAdminAvisos();
  } catch (erro) {
    console.error(erro);
    msg.textContent = "Erro ao conectar.";
  }
}

async function carregarAdminAvisos() {
  const container = document.getElementById("listaAdminAvisos");
  container.innerHTML = "<p>Carregando...</p>";

  try {
    const resposta = await fetch("/api/avisos");
    const avisos = await resposta.json();
    if (!resposta.ok || !avisos.length) { container.innerHTML = `<p class="sem-avisos">Nenhum aviso publicado.</p>`; return; }

    container.innerHTML = avisos.map(a => `
      <div class="aviso-card">
        <div class="aviso-titulo">${escapeHtml(a.titulo)}</div>
        <div class="aviso-data">🕐 ${formatarDataHora(a.criado_em)}</div>
        <div class="aviso-mensagem">${escapeHtml(a.mensagem)}</div>
        <button class="btn-excluir-aviso" onclick="excluirAviso(${a.id})">🗑️ EXCLUIR</button>
      </div>
    `).join("");
  } catch (erro) {
    console.error(erro);
    container.innerHTML = `<p class="sem-avisos">Erro ao conectar.</p>`;
  }
}

async function excluirAviso(id) {
  const jogador = lerSessao();
  if (!jogador || !jogador.admin) return;
  if (!confirm("Excluir este aviso?")) return;

  try {
    const resposta = await fetch(`/api/avisos/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogadorId: jogador.id })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { alert(dados.erro || "Erro."); return; }
    carregarAdminAvisos();
  } catch (erro) {
    console.error(erro);
    alert("Erro ao conectar.");
  }
}

// =====================================================
// ADMIN: GERENCIAR JOGADORES
// =====================================================

let _jogadorEditando = null;

function abrirAdminJogadores() {
  mostrarTela("telaAdminJogadores");
  document.getElementById("novoJogNome").value = "";
  document.getElementById("novoJogTelefone").value = "";
  document.getElementById("novoJogSenha").value = "";
  document.getElementById("mensagemNovoJog").textContent = "";
  carregarListaAdminJogadores();
}

function fecharAdminJogadores() { mostrarTela("telaAdm"); }

async function carregarListaAdminJogadores() {
  const admin = lerSessao();
  const container = document.getElementById("listaAdminJogadores");
  if (!admin || !admin.admin) { mostrarLogin(); return; }

  container.innerHTML = "<p>Carregando...</p>";

  try {
    const resposta = await fetch(`/api/admin/jogadores/${admin.id}`);
    const jogadores = await resposta.json();
    if (!resposta.ok) { container.innerHTML = `<p>${jogadores.erro || "Erro."}</p>`; return; }
    if (!jogadores.length) { container.innerHTML = "<p class='sem-mensalidade'>Nenhum jogador cadastrado.</p>"; return; }

    container.innerHTML = jogadores.map(j => {
      const ativo = j.ativo === 1;
      const deve = j.total_devido > 0;
      const badgeInativo = !ativo ? '<span class="badge-inativo">Inativo</span>' : "";
      const iconCoroa = j.admin ? "👑 " : "";
      const deveTexto = deve ? `<div class="jog-deve">🔴 Deve R$ ${Number(j.total_devido).toFixed(2).replace(".", ",")}</div>` : "";
      const btnAtivo = ativo
        ? `<button class="btn-mini desativar" onclick="desativarJogador(${j.id})">⏸ Desativar</button>`
        : `<button class="btn-mini ativar" onclick="reativarJogador(${j.id})">▶ Reativar</button>`;

      const btnTimeA = `<button class="btn-time-mini a ${j.time === 'A' ? 'ativo' : ''}" onclick="definirTime(${j.id}, 'A')">A</button>`;
      const btnTimeB = `<button class="btn-time-mini b ${j.time === 'B' ? 'ativo' : ''}" onclick="definirTime(${j.id}, 'B')">B</button>`;
      const btnTimeNone = `<button class="btn-time-mini none ${!j.time ? 'ativo' : ''}" onclick="definirTime(${j.id}, null)">-</button>`;

            return `
        <div class="admin-jogador-linha ${ativo ? "" : "inativo"}">
          <div style="flex:1; min-width:0;">
            <div class="jog-nome">${iconCoroa}${escapeHtml(j.nome)} ${badgeInativo}</div>
            <div class="jog-detalhe">${j.telefone || "sem telefone"}</div>
            ${deveTexto}
          </div>
          <div class="jog-acoes" style="flex-wrap: wrap; justify-content: flex-end;">
            <div class="btn-time-grupo">
              <button class="btn-time-mini a ${j.time === 'A' ? 'ativo' : ''}" onclick="definirTime(${j.id}, 'A')">A</button>
              <button class="btn-time-mini b ${j.time === 'B' ? 'ativo' : ''}" onclick="definirTime(${j.id}, 'B')">B</button>
              <button class="btn-time-mini none ${!j.time ? 'ativo' : ''}" onclick="definirTime(${j.id}, null)">-</button>
            </div>
            <button class="btn-mini editar" onclick="abrirEditarJogador(${j.id})">✏️</button>
            ${j.admin ? "" : btnAtivo}
          </div>
        </div>
      `;
    }).join("");
  } catch (erro) {
    console.error(erro);
    container.innerHTML = "<p>Erro ao carregar.</p>";
  }
}

async function cadastrarJogadorAdmin() {
  const admin = lerSessao();
  const msg = document.getElementById("mensagemNovoJog");
  if (!admin || !admin.admin) return;

  const nome = document.getElementById("novoJogNome").value.trim();
  const telefone = document.getElementById("novoJogTelefone").value.trim();
  const senha = document.getElementById("novoJogSenha").value;
  msg.textContent = "";

  if (!nome || !telefone || !senha) { msg.textContent = "Preencha nome, telefone e senha."; return; }

  try {
    const resposta = await fetch("/api/admin/jogadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: admin.id, nome, telefone, senha })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { msg.textContent = dados.erro || "Erro."; return; }

    alert("Jogador cadastrado! ⚽");
    document.getElementById("novoJogNome").value = "";
    document.getElementById("novoJogTelefone").value = "";
    document.getElementById("novoJogSenha").value = "";
    carregarListaAdminJogadores();
  } catch (erro) {
    console.error(erro);
    msg.textContent = "Erro ao conectar.";
  }
}

async function abrirEditarJogador(id) {
  const admin = lerSessao();
  if (!admin || !admin.admin) return;

  _jogadorEditando = id;
  mostrarTela("telaAdminEditarJogador");
  document.getElementById("adminEditarSubtitulo").textContent = "Carregando...";
  document.getElementById("editJogNome").value = "";
  document.getElementById("editJogTelefone").value = "";
  document.getElementById("editJogSenha").value = "";
  document.getElementById("mensagemEditJog").textContent = "";

  try {
    const resposta = await fetch(`/api/admin/jogadores/${admin.id}`);
    const jogadores = await resposta.json();
    const j = jogadores.find(x => x.id === id);

    if (!j) { alert("Jogador não encontrado."); fecharAdminEditarJogador(); return; }

    document.getElementById("adminEditarSubtitulo").textContent = `Editando: ${j.nome}`;
    document.getElementById("editJogNome").value = j.nome;
    document.getElementById("editJogTelefone").value = j.telefone || "";
  } catch (erro) {
    console.error(erro);
    alert("Erro ao carregar.");
  }
}

function fecharAdminEditarJogador() { abrirAdminJogadores(); }

async function salvarEdicaoJogadorAdmin() {
  const admin = lerSessao();
  const msg = document.getElementById("mensagemEditJog");
  if (!admin || !admin.admin || !_jogadorEditando) return;

  const nome = document.getElementById("editJogNome").value.trim();
  const telefone = document.getElementById("editJogTelefone").value.trim();
  const senha = document.getElementById("editJogSenha").value;
  msg.textContent = "";

  if (!nome) { msg.textContent = "Nome é obrigatório."; return; }

  try {
    const resposta = await fetch(`/api/admin/jogadores/${_jogadorEditando}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: admin.id, nome, telefone, senha })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { msg.textContent = dados.erro || "Erro."; return; }

    alert("Jogador atualizado! ✏️");
    abrirAdminJogadores();
  } catch (erro) {
    console.error(erro);
    msg.textContent = "Erro ao conectar.";
  }
}

async function desativarJogador(id) {
  const admin = lerSessao();
  if (!admin || !admin.admin) return;
  if (!confirm("Desativar esse jogador?\nEle não vai aparecer mais nas listas de presença, mas o histórico de mensalidade fica salvo.")) return;

  try {
    const resposta = await fetch(`/api/admin/jogadores/${id}/ativo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: admin.id, ativo: false })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { alert(dados.erro || "Erro."); return; }
    carregarListaAdminJogadores();
  } catch (erro) {
    console.error(erro);
    alert("Erro ao conectar.");
  }
}

async function reativarJogador(id) {
  const admin = lerSessao();
  if (!admin || !admin.admin) return;

  try {
    const resposta = await fetch(`/api/admin/jogadores/${id}/ativo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: admin.id, ativo: true })
    });

    const dados = await resposta.json();
    if (!resposta.ok) { alert(dados.erro || "Erro."); return; }
    carregarListaAdminJogadores();
  } catch (erro) {
    console.error(erro);
    alert("Erro ao conectar.");
  }
}

async function definirTime(jogadorId, time) {
  const admin = lerSessao();
  if (!admin || !admin.admin) return;

  try {
    const resposta = await fetch(`/api/admin/jogadores/${jogadorId}/time`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: admin.id, time })
    });

    if (!resposta.ok) {
      const dados = await resposta.json();
      alert(dados.erro || "Erro ao definir time.");
      return;
    }
    carregarListaAdminJogadores();
  } catch (erro) {
    console.error(erro);
    alert("Erro ao conectar.");
  }
}

// =====================================================
// ADMIN: LANÇAR RESULTADO
// =====================================================

let _jogoEditandoPlacar = null;

function abrirAdminResultados() { mostrarTela("telaAdminResultados"); carregarJogosPassados(); }
function fecharAdminResultados() { mostrarTela("telaAdm"); }

async function carregarJogosPassados() {
  const admin = lerSessao();
  const container = document.getElementById("listaJogosPassados");
  container.innerHTML = "<p>Carregando...</p>";

  try {
    const res = await fetch(`/api/admin/jogos-passados/${admin.id}`);
    const jogos = await res.json();
    if (!jogos.length) { container.innerHTML = "<p class='sem-avisos'>Nenhum jogo passado.</p>"; return; }

    container.innerHTML = jogos.map(j => {
      const placar = j.gols_time_a !== null ? `${j.gols_time_a} x ${j.gols_time_b}` : "Aguardando placar";
      return `
      <div class="placar-card">
        <div class="placar-info">
          <div class="placar-data">📅 ${new Date(j.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
          <div class="placar-placar">${placar}</div>
        </div>
        <button class="placar-btn" onclick="abrirAdminEditarPlacar(${j.id}, '${j.data}', ${j.gols_time_a}, ${j.gols_time_b})">✏️ Placar</button>
      </div>
    `}).join("");
  } catch (e) { container.innerHTML = "<p>Erro.</p>"; }
}

function abrirAdminEditarPlacar(id, data, gA, gB) {
  _jogoEditandoPlacar = id;
  mostrarTela("telaAdminEditarPlacar");
  document.getElementById("placarSubtitulo").textContent = `Jogo de ${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}`;
  document.getElementById("golsTimeA").value = gA !== null ? gA : 0;
  document.getElementById("golsTimeB").value = gB !== null ? gB : 0;
}

function fecharAdminEditarPlacar() { abrirAdminResultados(); }

async function salvarPlacar() {
  const admin = lerSessao();
  const gA = document.getElementById("golsTimeA").value;
  const gB = document.getElementById("golsTimeB").value;

  try {
    await fetch(`/api/admin/jogos/${_jogoEditandoPlacar}/resultado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: admin.id, gols_time_a: gA, gols_time_b: gB })
    });
    alert("Placar salvo! 🏆");
    abrirAdminResultados();
  } catch (e) { alert("Erro."); }
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

(function iniciar() {
  const jogador = lerSessao();
  if (jogador) {
    mostrarApp();
  } else {
    mostrarLogin();
  }
})();