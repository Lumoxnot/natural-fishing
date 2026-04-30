'use strict';

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  API_URL: window.API_BASE_URL || 'https://natural-fishing.onrender.com',
  TOKEN_KEY: 'nf_user_token',
  USER_KEY: 'nf_logged_user',
  CART_KEY: 'nf_cart_v2'
};

// ============================================================
// UTILS
// ============================================================
const Utils = {
  formatarMoeda(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  },

  formatarData(d) {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatarCategoria(cat) {
    const m = { varas:'Varas', molinetes:'Molinetes', iscas:'Iscas',
                linhas:'Linhas', anzois:'Anzóis', acessorios:'Acessórios' };
    return m[cat] || cat;
  },

  formatarTelefone(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  },

  formatarCEP(v) {
    return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2');
  },

  getToken()       { return localStorage.getItem(CONFIG.TOKEN_KEY); },
  setToken(t)      { localStorage.setItem(CONFIG.TOKEN_KEY, t); },
  removeToken()    {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },

  getLoggedUser() {
    try {
      const u = localStorage.getItem(CONFIG.USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  },
  setLoggedUser(u) { localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(u)); },

  getParam(n)      { return new URLSearchParams(window.location.search).get(n); },

  debounce(fn, d = 400) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); };
  },

  renderEstrelas(media, total) {
    const cheia = Math.round(media);
    const estrelas = Array.from({ length: 5 }, (_, i) =>
      i < cheia ? '★' : '☆'
    ).join('');
    return `<div class="estrelas">${estrelas} <span>${media > 0 ? media.toFixed(1) : 'Sem avaliações'} (${total})</span></div>`;
  },

  labelStatus(s) {
    const m = {
      pendente: 'Pendente', pago: 'Pago',
      em_preparo: 'Em Preparo', enviado: 'Enviado',
      entregue: 'Entregue', cancelado: 'Cancelado'
    };
    return m[s] || s;
  }
};

// ============================================================
// LOADING & TOAST
// ============================================================
const Loading = {
  overlay: null,
  init()         { this.overlay = document.getElementById('loading-overlay'); },
  mostrar(t='Carregando...') {
    if (!this.overlay) return;
    const p = this.overlay.querySelector('p');
    if (p) p.textContent = t;
    this.overlay.classList.remove('oculto');
  },
  ocultar()      { this.overlay?.classList.add('oculto'); }
};

const Toast = {
  container: null,
  init()         { this.container = document.getElementById('toast-container'); },
  mostrar(msg, tipo='info', dur=3500) {
    if (!this.container) return;
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.textContent = msg;
    this.container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(120%)';
      t.style.transition = 'all 0.4s ease';
      setTimeout(() => t.remove(), 400);
    }, dur);
  },
  sucesso(m) { this.mostrar(m, 'sucesso'); },
  erro(m)    { this.mostrar(m, 'erro'); },
  info(m)    { this.mostrar(m, 'info'); }
};

// ============================================================
// API
// ============================================================
const API = {
  async req(endpoint, opts = {}) {
    const token = Utils.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers
    };
    try {
      const r = await fetch(`${CONFIG.API_URL}${endpoint}`, { ...opts, headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);
      return d;
    } catch (err) {
      if (err instanceof TypeError) throw new Error('Servidor indisponível.');
      throw err;
    }
  },

  // Auth
  login: (e, s)    => API.req('/auth/login',    { method:'POST', body: JSON.stringify({ email:e, senha:s }) }),
  register: (d)    => API.req('/auth/register', { method:'POST', body: JSON.stringify(d) }),
  perfil: ()       => API.req('/auth/perfil'),
  listUsers: ()    => API.req('/auth/users'),
  updateRole: (id, role) => API.req(`/auth/users/${id}/role`, { method:'PUT', body: JSON.stringify({ role }) }),

  // Produtos
  listarProdutos: (f={}) => {
    const p = new URLSearchParams();
    if (f.categoria && f.categoria !== 'todos') p.append('categoria', f.categoria);
    if (f.busca)      p.append('busca', f.busca);
    if (f.preco_min)  p.append('preco_min', f.preco_min);
    if (f.preco_max)  p.append('preco_max', f.preco_max);
    if (f.ordenar)    p.append('ordenar', f.ordenar);
    const q = p.toString() ? `?${p}` : '';
    return API.req(`/produtos${q}`);
  },
  obterProduto: (id)       => API.req(`/produtos/${id}`),
  criarProduto: (d)        => API.req('/produtos', { method:'POST', body: JSON.stringify(d) }),
  atualizarProduto: (id,d) => API.req(`/produtos/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  deletarProduto: (id)     => API.req(`/produtos/${id}`, { method:'DELETE' }),

  // Pedidos
  criarPedido: (d)         => API.req('/pedidos', { method:'POST', body: JSON.stringify(d) }),
  meusPedidos: ()          => API.req('/pedidos/meus'),
  obterPedido: (id)        => API.req(`/pedidos/${id}`),
  todosPedidos: (s)        => API.req(`/pedidos/admin/todos${s ? '?status='+s : ''}`),
  statsAdmin: ()           => API.req('/pedidos/admin/stats'),
  atualizarStatus: (id,s)  => API.req(`/pedidos/${id}/status`, { method:'PUT', body: JSON.stringify({ status:s }) }),

  // Extras
  criarAvaliacao: (d)      => API.req('/extras/avaliacoes', { method:'POST', body: JSON.stringify(d) }),
  avaliacoesProduto: (id)  => API.req(`/extras/avaliacoes/${id}`),
  toggleFavorito: (pid)    => API.req('/extras/favoritos', { method:'POST', body: JSON.stringify({ produto_id: pid }) }),
  meurosFavoritos: ()      => API.req('/extras/favoritos'),
  notificacoes: ()         => API.req('/extras/notificacoes'),
  marcarLida: (id)         => API.req(`/extras/notificacoes/${id}/lida`, { method:'PUT' }),
  marcarTodasLidas: ()     => API.req('/extras/notificacoes/todas/lidas', { method:'PUT' }),
  validarCupom: (c, s)     => API.req('/extras/cupons/validar', { method:'POST', body: JSON.stringify({ codigo:c, subtotal:s }) }),
  criarCupom: (d)          => API.req('/extras/cupons', { method:'POST', body: JSON.stringify(d) }),
  listarCupons: ()         => API.req('/extras/cupons'),
};

// ============================================================
// CEP
// ============================================================
const CEP = {
  async buscar(cep) {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) throw new Error('CEP inválido.');
    const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    const d = await r.json();
    if (d.erro) throw new Error('CEP não encontrado.');
    return d;
  }
};

// ============================================================
// NAV AUTH
// ============================================================
const NavAuth = {
  render() {
    const container = document.getElementById('nav-auth');
    if (!container) return;
    const user = Utils.getLoggedUser();

    if (!user) {
      container.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn-nav btn-nav-login"
            onclick="window.location.href='/login'">Entrar</button>
          <button class="btn-nav btn-nav-cadastro"
            onclick="window.location.href='/cadastro'">Cadastrar</button>
        </div>`;
    } else if (user.role === 'admin') {
      container.innerHTML = `
        <div class="nav-auth-logado">
          <div style="position:relative;">
            <button class="btn-notificacoes" id="btn-notif" aria-label="Notificações">
              🔔 <span class="badge-notif" id="badge-notif"></span>
            </button>
            <div class="painel-notificacoes" id="painel-notif"></div>
          </div>
          <span title="${user.email}">👤 ${user.nome || user.email}</span>
          <button class="btn-nav btn-nav-admin"
            onclick="window.location.href='/dashboard'">Painel</button>
          <button class="btn-nav btn-nav-sair" onclick="NavAuth.sair()">Sair</button>
        </div>`;
      Notificacoes.init();
    } else {
      container.innerHTML = `
        <div class="nav-auth-logado">
          <div style="position:relative;">
            <button class="btn-notificacoes" id="btn-notif" aria-label="Notificações">
              🔔 <span class="badge-notif" id="badge-notif"></span>
            </button>
            <div class="painel-notificacoes" id="painel-notif"></div>
          </div>
          <span title="${user.email}">👤 ${user.nome || user.email}</span>
          <button class="btn-nav btn-nav-login"
            onclick="window.location.href='/pedidos'">Pedidos</button>
          <button class="btn-nav btn-nav-sair" onclick="NavAuth.sair()">Sair</button>
        </div>`;
      Notificacoes.init();
    }
  },

  sair() {
    Utils.removeToken();
    Toast.sucesso('Até logo! 🎣');
    setTimeout(() => window.location.href = '/', 800);
  }
};

// ============================================================
// MENU MOBILE
// ============================================================
const MenuMobile = {
  aberto: false,

  init() {
    this.bindEventos();
    this.renderizar();
  },

  renderizar() {
    const body = document.getElementById('mobile-menu-body');
    if (!body) return;

    const user        = Utils.getLoggedUser();
    const paginaAtual = window.location.pathname.split('/').pop() || '/';

    const itemLoja = `
      <button class="mobile-menu-item" onclick="MenuMobile.ir('/')">
        <span class="icone-menu">🎣</span> Loja
      </button>`;

    if (!user) {
      body.innerHTML = `
        ${itemLoja}
        <div class="mobile-menu-divider"></div>
        <button class="mobile-menu-item" onclick="MenuMobile.ir('/login')">
          <span class="icone-menu">🔑</span> Entrar
        </button>
        <button class="mobile-menu-item" onclick="MenuMobile.ir('/cadastro')">
          <span class="icone-menu">📝</span> Cadastrar
        </button>
      `;
    } else if (user.role === 'admin') {
      body.innerHTML = `
        <div class="mobile-menu-usuario">
          <div class="nome">👤 ${user.nome || 'Admin'}</div>
          <div class="email">${user.email}</div>
        </div>
        <button class="mobile-menu-item" onclick="MenuMobile.ir('/dashboard')">
          <span class="icone-menu">📊</span> Painel Admin
        </button>
        ${itemLoja}
        <div class="mobile-menu-divider"></div>
        <button class="mobile-menu-item mobile-menu-sair" onclick="MenuMobile.sair()">
          <span class="icone-menu">🚪</span> Sair
        </button>
      `;
    } else {
      body.innerHTML = `
        <div class="mobile-menu-usuario">
          <div class="nome">👤 ${user.nome || 'Usuário'}</div>
          <div class="email">${user.email}</div>
        </div>
        ${itemLoja}
        <button class="mobile-menu-item ${paginaAtual === '/pedidos' ? 'mobile-menu-ativo' : ''}"
          onclick="MenuMobile.ir('/pedidos')">
          <span class="icone-menu">📦</span> Meus Pedidos
        </button>
        <button class="mobile-menu-item ${paginaAtual === '/favoritos' ? 'mobile-menu-ativo' : ''}"
          onclick="MenuMobile.ir('/favoritos')">
          <span class="icone-menu">❤️</span> Favoritos
        </button>
        <div class="mobile-menu-divider"></div>
        <button class="mobile-menu-item mobile-menu-sair" onclick="MenuMobile.sair()">
          <span class="icone-menu">🚪</span> Sair
        </button>
      `;
    }
  },

  abrir() {
    this.aberto = true;
    document.getElementById('mobile-menu')?.classList.add('aberto');
    document.getElementById('mobile-menu-overlay')?.classList.add('ativo');
    document.getElementById('btn-hamburger')?.classList.add('ativo');
    document.body.style.overflow = 'hidden';
  },

  fechar() {
    this.aberto = false;
    document.getElementById('mobile-menu')?.classList.remove('aberto');
    document.getElementById('mobile-menu-overlay')?.classList.remove('ativo');
    document.getElementById('btn-hamburger')?.classList.remove('ativo');
    document.body.style.overflow = '';
  },

  toggle() {
    this.aberto ? this.fechar() : this.abrir();
  },

  ir(url) {
    this.fechar();
    setTimeout(() => window.location.href = url, 200);
  },

  irAncora(ancora) {
    this.fechar();
    setTimeout(() => {
      const el = document.querySelector(ancora);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  },

  sair() {
    this.fechar();
    Utils.removeToken();
    Toast.sucesso('Até logo! 🎣');
    setTimeout(() => window.location.href = '/', 800);
  },

  bindEventos() {
    document.getElementById('btn-hamburger')
      ?.addEventListener('click', () => this.toggle());

    document.getElementById('btn-fechar-menu')
      ?.addEventListener('click', () => this.fechar());

    document.getElementById('mobile-menu-overlay')
      ?.addEventListener('click', () => this.fechar());

    document.getElementById('btn-abrir-carrinho-mobile')
      ?.addEventListener('click', () => {
        this.fechar();
        Carrinho.abrir();
      });
  }
};
// ============================================================
// NOTIFICAÇÕES
// ============================================================
const Notificacoes = {
  lista: [],

  async init() {
    if (!Utils.getToken()) return;
    await this.carregar();
    this.bindEventos();
  },

  async carregar() {
    try {
      this.lista = await API.notificacoes();
      this.renderizar();
      this.atualizarBadge();
    } catch {}
  },

  atualizarBadge() {
    const badge = document.getElementById('badge-notif');
    if (!badge) return;
    const naoLidas = this.lista.filter(n => !n.lida).length;
    badge.textContent = naoLidas;
    badge.classList.toggle('visivel', naoLidas > 0);
  },

  renderizar() {
    const painel = document.getElementById('painel-notif');
    if (!painel) return;

    if (this.lista.length === 0) {
      painel.innerHTML = `
        <div class="notif-header">
          <h3>🔔 Notificações</h3>
        </div>
        <div class="notif-vazia">Nenhuma notificação ainda.</div>`;
      return;
    }

    const itens = this.lista.map(n => `
      <div class="notif-item ${n.lida ? '' : 'nao-lida'}"
        onclick="Notificacoes.marcarLida('${n.id}')">
        <div class="notif-titulo">${n.titulo}</div>
        <div class="notif-msg">${n.mensagem}</div>
        <div class="notif-data">${Utils.formatarData(n.created_at)}</div>
      </div>
    `).join('');

    painel.innerHTML = `
      <div class="notif-header">
        <h3>🔔 Notificações</h3>
        <button class="btn-marcar-todas" onclick="Notificacoes.marcarTodasLidas()">
          Marcar todas como lidas
        </button>
      </div>
      ${itens}`;
  },

  async marcarLida(id) {
    try {
      await API.marcarLida(id);
      const n = this.lista.find(x => x.id === id);
      if (n) n.lida = true;
      this.renderizar();
      this.atualizarBadge();
    } catch {}
  },

  async marcarTodasLidas() {
    try {
      await API.marcarTodasLidas();
      this.lista.forEach(n => n.lida = true);
      this.renderizar();
      this.atualizarBadge();
    } catch {}
  },

  bindEventos() {
    const btn   = document.getElementById('btn-notif');
    const painel = document.getElementById('painel-notif');
    if (!btn || !painel) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      painel.classList.toggle('aberto');
    });

    document.addEventListener('click', (e) => {
      if (!painel.contains(e.target) && e.target !== btn) {
        painel.classList.remove('aberto');
      }
    });
  }
};

// ============================================================
// CARRINHO — Seguro: nunca confia em preço do frontend
// ============================================================
const Carrinho = {
  itens: [],
  cupom: null,
  frete: 0,

  init() {
    this.carregar();
    this.renderizar();
    this.atualizarBadge();
    this.bindEventos();
  },

  carregar() {
    try {
      const s = localStorage.getItem(CONFIG.CART_KEY);
      this.itens = s ? JSON.parse(s) : [];
    } catch { this.itens = []; }
  },

  salvar() { localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(this.itens)); },

  adicionar(produto) {
    // Bloqueia se não estiver logado
    const user = Utils.getLoggedUser();
    if (!user) {
      Toast.erro('Faça login para adicionar ao carrinho!');
      setTimeout(() => window.location.href = '/login', 1200);
      return;
    }

    // Bloqueia se esgotado
    if (produto.estoque === 0) {
      Toast.erro('Produto esgotado!');
      return;
    }

    const existente = this.itens.find(i => i.id === produto.id);
    if (existente) {
      if (existente.quantidade >= produto.estoque) {
        Toast.erro(`Estoque máximo: ${produto.estoque} unidades`);
        return;
      }
      existente.quantidade += 1;
      Toast.info(`+1 ${produto.nome} no carrinho`);
    } else {
      this.itens.push({
        id: produto.id,
        nome: produto.nome,
        // Guardamos o preço do produto como referência visual,
        // mas o backend SEMPRE recalcula no finalizar pedido
        preco: produto.preco,
        imagem_url: produto.imagem_url,
        quantidade: 1,
        estoque: produto.estoque
      });
      Toast.sucesso(`${produto.nome} adicionado! 🎣`);
    }

    this.salvar();
    this.renderizar();
    this.atualizarBadge();
    this.abrir();
  },

  remover(id) {
    this.itens = this.itens.filter(i => i.id !== id);
    this.salvar();
    this.renderizar();
    this.atualizarBadge();
  },

  alterarQuantidade(id, delta) {
    const item = this.itens.find(i => i.id === id);
    if (!item) return;

    const novaQtd = item.quantidade + delta;
    if (novaQtd <= 0) { this.remover(id); return; }
    if (novaQtd > item.estoque) {
      Toast.erro(`Estoque máximo: ${item.estoque}`);
      return;
    }

    item.quantidade = novaQtd;
    this.salvar();
    this.renderizar();
    this.atualizarBadge();
  },

  calcularSubtotal() {
    return parseFloat(this.itens.reduce((a, i) => a + (i.preco * i.quantidade), 0).toFixed(2));
  },

  quantidadeTotal() {
    return this.itens.reduce((a, i) => a + i.quantidade, 0);
  },

  atualizarBadge() {
    const b = document.getElementById('badge-carrinho');
    if (b) b.textContent = this.quantidadeTotal();
  },

  abrir() {
    document.getElementById('sidebar-carrinho')?.classList.add('ativo');
    document.getElementById('overlay-carrinho')?.classList.add('ativo');
    document.body.style.overflow = 'hidden';
  },

  fechar() {
    document.getElementById('sidebar-carrinho')?.classList.remove('ativo');
    document.getElementById('overlay-carrinho')?.classList.remove('ativo');
    document.body.style.overflow = '';
  },

  async aplicarCupom() {
    const input = document.getElementById('input-cupom');
    const codigo = input?.value.trim().toUpperCase();
    if (!codigo) { Toast.erro('Digite um código de cupom.'); return; }

    try {
      const subtotal = this.calcularSubtotal();
      const resp = await API.validarCupom(codigo, subtotal);
      this.cupom = { codigo: resp.codigo, desconto: resp.desconto };
      Toast.sucesso(`Cupom aplicado! Desconto: ${Utils.formatarMoeda(resp.desconto)}`);
      this.renderizar();
    } catch (err) {
      this.cupom = null;
      Toast.erro(err.message);
    }
  },

  renderizar() {
    const container = document.getElementById('carrinho-itens');
    const footer    = document.getElementById('carrinho-footer');
    const valorTotal = document.getElementById('valor-total');

    if (!container) return;

    if (this.itens.length === 0) {
      container.innerHTML = `
        <div class="carrinho-vazio">
          <div class="icone">🎣</div>
          <p>Seu carrinho está vazio.</p>
        </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    container.innerHTML = this.itens.map(item => `
      <div class="item-carrinho">
        <img
          src="${item.imagem_url || 'https://via.placeholder.com/64?text=🎣'}"
          alt="${item.nome}"
          onerror="this.src='https://via.placeholder.com/64?text=🎣'"
        />
        <div class="item-info">
          <div class="item-nome">${item.nome}</div>
          <div class="item-preco">${Utils.formatarMoeda(item.preco * item.quantidade)}</div>
          <div class="item-controles">
            <button onclick="Carrinho.alterarQuantidade('${item.id}', -1)">−</button>
            <span class="item-quantidade">${item.quantidade}</span>
            <button onclick="Carrinho.alterarQuantidade('${item.id}', 1)">+</button>
          </div>
        </div>
        <button class="btn-remover-item" onclick="Carrinho.remover('${item.id}')">🗑️</button>
      </div>
    `).join('');

    if (footer) {
      footer.style.display = 'flex';
      footer.style.flexDirection = 'column';
      footer.style.gap = '4px';

      // Campo cupom
      const subtotal = this.calcularSubtotal();
      const desconto = this.cupom?.desconto || 0;
      const total    = Math.max(0, subtotal - desconto + this.frete);

      footer.innerHTML = `
        <div class="campo-cupom">
          <input type="text" id="input-cupom" placeholder="CÓDIGO DO CUPOM"
            value="${this.cupom?.codigo || ''}"/>
          <button class="btn-aplicar-cupom" onclick="Carrinho.aplicarCupom()">
            Aplicar
          </button>
        </div>
        ${desconto > 0 ? `
          <div class="linha-cupom">
            <span>🎟️ Desconto (${this.cupom.codigo})</span>
            <span>-${Utils.formatarMoeda(desconto)}</span>
          </div>` : ''}
        <div class="linha-frete">
          <span>🚚 Frete</span>
          <span>${this.frete === 0 ? 'Grátis' : Utils.formatarMoeda(this.frete)}</span>
        </div>
        <div class="linha-total">
          <span>Total</span>
          <span class="valor-total">${Utils.formatarMoeda(total)}</span>
        </div>
        <button class="btn-finalizar" id="btn-finalizar">Finalizar Pedido</button>
      `;

      document.getElementById('btn-finalizar')?.addEventListener('click', () => {
        this.finalizarPedido();
      });
    }
  },

  async finalizarPedido() {
    const user = Utils.getLoggedUser();
    if (!user) {
      Toast.erro('Faça login para finalizar a compra!');
      setTimeout(() => window.location.href = '/login', 1200);
      return;
    }

    if (this.itens.length === 0) {
      Toast.erro('Seu carrinho está vazio.');
      return;
    }

    const btnFinalizar = document.getElementById('btn-finalizar');
    if (btnFinalizar) {
      btnFinalizar.disabled = true;
      btnFinalizar.textContent = 'Processando...';
    }

    Loading.mostrar('Processando pedido...');

    try {
      // Busca perfil para pegar CEP
      const perfil = await API.perfil();

      // Monta payload — backend SEMPRE valida e recalcula preços
      const payload = {
        itens: this.itens.map(i => ({
          produto_id: i.id,
          quantidade: i.quantidade
          // NÃO enviamos o preço — backend busca do banco
        })),
        cupon_codigo: this.cupom?.codigo || null,
        cep_entrega: perfil.cep
      };

      const resp = await API.criarPedido(payload);

      Toast.sucesso('Pedido realizado com sucesso! 🎣');
      this.itens = [];
      this.cupom = null;
      this.salvar();
      this.renderizar();
      this.atualizarBadge();
      this.fechar();

      setTimeout(() => window.location.href = '/pedidos', 1500);

    } catch (err) {
      Toast.erro(err.message);
      if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = 'Finalizar Pedido';
      }
    } finally {
      Loading.ocultar();
    }
  },

  bindEventos() {
    document.getElementById('btn-abrir-carrinho')?.addEventListener('click', () => this.abrir());
    document.getElementById('btn-fechar-carrinho')?.addEventListener('click', () => this.fechar());
    document.getElementById('overlay-carrinho')?.addEventListener('click', () => this.fechar());
  }
};

// ============================================================
// PÁGINA: LOJA (index.html)
// ============================================================
const PaginaLoja = {
  produtos: [],
  favoritos: [],
  filtros: { busca:'', categoria:'todos', preco_min:'', preco_max:'', ordenar:'' },

  async init() {
    NavAuth.render();
    Loading.mostrar('Carregando produtos...');
    try {
      await Promise.all([
        this.carregarProdutos(),
        this.carregarFavoritos()
      ]);
    } finally {
      Loading.ocultar();
    }
    this.bindEventos();
  },

  async carregarProdutos() {
    try {
      this.produtos = await API.listarProdutos(this.filtros);
      this.renderizarProdutos(this.produtos);
    } catch (err) {
      Toast.erro(err.message);
      this.renderizarVazio('Erro ao carregar produtos.');
    }
  },

  async carregarFavoritos() {
    if (!Utils.getToken()) return;
    try {
      const favs = await API.meurosFavoritos();
      this.favoritos = favs.map(f => f.id);
    } catch {}
  },

  renderizarProdutos(lista) {
    const grid    = document.getElementById('grid-produtos');
    const contagem = document.getElementById('contagem-produtos');
    if (!grid) return;

    if (contagem) {
      contagem.textContent = lista.length > 0
        ? `${lista.length} produto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`
        : '';
    }

    if (lista.length === 0) {
      this.renderizarVazio('Nenhum produto encontrado.');
      return;
    }

    grid.innerHTML = lista.map(p => {
      const esgotado = p.estoque === 0;
      const estoqueBaixo = p.estoque > 0 && p.estoque <= 3;
      const favoritado = this.favoritos.includes(p.id);

      return `
        <article class="card-produto ${esgotado ? 'esgotado' : ''}" tabindex="0">
          <div class="card-img-wrapper">
            <img class="card-produto-img"
              src="${p.imagem_url || 'https://via.placeholder.com/400x300?text=🎣'}"
              alt="${p.nome}" loading="lazy"
              onerror="this.src='https://via.placeholder.com/400x300?text=🎣'"/>
            <span class="badge-categoria">${Utils.formatarCategoria(p.categoria)}</span>
            ${esgotado ? '<span class="badge-esgotado">Esgotado</span>' : ''}
            ${estoqueBaixo ? `<span class="badge-estoque-baixo">Últimas ${p.estoque}!</span>` : ''}
            ${Utils.getToken() ? `
              <button class="btn-favorito ${favoritado ? 'ativo' : ''}"
                onclick="PaginaLoja.toggleFavorito(event, '${p.id}')"
                title="${favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
                ${favoritado ? '❤️' : '🤍'}
              </button>` : ''}
          </div>
          <div class="card-body">
            <h3 class="card-nome">${p.nome}</h3>
            <p class="card-descricao">${p.descricao || 'Produto de qualidade para pesca.'}</p>
            ${Utils.renderEstrelas(p.media_avaliacao, p.total_avaliacoes)}
            <div class="card-preco">${Utils.formatarMoeda(p.preco)}</div>
            ${!esgotado ? `<small style="color:#888;font-size:0.72rem;">
              ${p.estoque} em estoque
            </small>` : ''}
          </div>
          <div class="card-footer">
            <button class="btn-detalhes"
              onclick="window.location.href='produto.html?id=${p.id}'">
              Detalhes
            </button>
            <button class="btn-comprar" ${esgotado ? 'disabled' : ''}
              onclick="${esgotado ? '' : `Carrinho.adicionar(${JSON.stringify(p).replace(/"/g,'&quot;')})`}">
              ${esgotado ? 'Esgotado' : '🛒 Comprar'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  },

  async toggleFavorito(e, produtoId) {
    e.stopPropagation();
    try {
      const resp = await API.toggleFavorito(produtoId);
      if (resp.favoritado) {
        this.favoritos.push(produtoId);
        Toast.sucesso('Adicionado aos favoritos! ❤️');
      } else {
        this.favoritos = this.favoritos.filter(id => id !== produtoId);
        Toast.info('Removido dos favoritos.');
      }
      this.renderizarProdutos(this.produtos);
    } catch (err) {
      Toast.erro(err.message);
    }
  },

  renderizarVazio(msg) {
    const grid = document.getElementById('grid-produtos');
    const contagem = document.getElementById('contagem-produtos');
    if (contagem) contagem.textContent = '';
    if (grid) {
      grid.innerHTML = `
        <div class="estado-vazio">
          <div class="icone-vazio">🎣</div>
          <h3>${msg}</h3>
          <p>Tente outros filtros ou termos.</p>
        </div>`;
    }
  },

  bindEventos() {
    const inputBusca = document.getElementById('input-busca');
    const filtroCat  = document.getElementById('filtro-categoria');
    const filtroMin  = document.getElementById('filtro-preco-min');
    const filtroMax  = document.getElementById('filtro-preco-max');
    const filtroOrdem = document.getElementById('filtro-ordenar');
    const btnLimpar  = document.getElementById('btn-limpar-filtros');

    const buscar = Utils.debounce(async () => {
      this.filtros.busca = inputBusca?.value.trim() || '';
      await this.carregarProdutos();
    }, 450);

    inputBusca?.addEventListener('input', buscar);

    filtroCat?.addEventListener('change', async () => {
      this.filtros.categoria = filtroCat.value;
      await this.carregarProdutos();
    });

    const filtroPreco = Utils.debounce(async () => {
      this.filtros.preco_min = filtroMin?.value || '';
      this.filtros.preco_max = filtroMax?.value || '';
      await this.carregarProdutos();
    }, 600);

    filtroMin?.addEventListener('input', filtroPreco);
    filtroMax?.addEventListener('input', filtroPreco);

    filtroOrdem?.addEventListener('change', async () => {
      this.filtros.ordenar = filtroOrdem.value;
      await this.carregarProdutos();
    });

    btnLimpar?.addEventListener('click', async () => {
      this.filtros = { busca:'', categoria:'todos', preco_min:'', preco_max:'', ordenar:'' };
      if (inputBusca)  inputBusca.value = '';
      if (filtroCat)   filtroCat.value  = 'todos';
      if (filtroMin)   filtroMin.value  = '';
      if (filtroMax)   filtroMax.value  = '';
      if (filtroOrdem) filtroOrdem.value = '';
      await this.carregarProdutos();
    });
  }
};

// ============================================================
// PÁGINA: DETALHE DO PRODUTO
// ============================================================
const PaginaDetalhe = {
  produto: null,

  async init() {
    const id = Utils.getParam('id');
    if (!id) { window.location.href = '/'; return; }
    NavAuth.render();
    Loading.mostrar('Carregando produto...');
    try {
      this.produto = await API.obterProduto(id);
      this.renderizar();
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      Loading.ocultar();
    }
  },

  renderizar() {
    const p = this.produto;
    const container = document.getElementById('detalhe-container');
    if (!container || !p) return;

    document.title = `${p.nome} — Natural Fishing`;
    const esgotado = p.estoque === 0;

         container.innerHTML = `
      <a href="/" class="btn-voltar">← Voltar para produtos</a>
      <div class="detalhe-card">
        <div class="detalhe-img-wrapper">
          <img class="detalhe-img"
            src="${p.imagem_url || 'https://via.placeholder.com/600x420?text=🎣'}"
            alt="${p.nome}"
            onerror="this.src='https://via.placeholder.com/600x420?text=🎣'"/>
        </div>
        <div class="detalhe-info">
          <span class="detalhe-categoria">${Utils.formatarCategoria(p.categoria)}</span>
          <h1 class="detalhe-nome">${p.nome}</h1>
          ${Utils.renderEstrelas(p.media_avaliacao, p.total_avaliacoes)}
          <div class="detalhe-preco">${Utils.formatarMoeda(p.preco)}</div>
          <p class="detalhe-descricao">
            ${p.descricao || 'Produto de alta qualidade para pesca.'}
          </p>
          ${esgotado
            ? `<div class="badge-esgotado" style="position:static;display:inline-block;margin-bottom:12px;">
                Produto Esgotado
               </div>`
            : `<p style="font-size:0.8rem;color:#888;margin-bottom:12px;">
                📦 ${p.estoque} unidade${p.estoque !== 1 ? 's' : ''} em estoque
               </p>`
          }
          <div class="detalhe-acoes">
            <button class="btn-comprar"
              style="flex:1;padding:14px;font-size:1rem;"
              id="btn-adicionar-detalhe"
              ${esgotado ? 'disabled' : ''}>
              ${esgotado ? 'Produto Esgotado' : '🛒 Adicionar ao Carrinho'}
            </button>
          </div>
          <p style="font-size:0.78rem;color:#888;margin-top:8px;">
            📦 Enviamos para toda a região de Caraguatatuba
          </p>
        </div>
      </div>

      <div class="secao-avaliacoes">
        <h3>⭐ Avaliações dos clientes</h3>
        ${Utils.getToken() ? `
          <div class="form-avaliacao">
            <p style="font-size:0.85rem;font-weight:700;color:var(--azul-escuro);margin-bottom:8px;">
              Deixe sua avaliação:
            </p>
            <div class="seletor-estrelas" id="seletor-estrelas">
              <input type="radio" id="s5" name="nota" value="5"/>
              <label for="s5" title="5 estrelas">★</label>
              <input type="radio" id="s4" name="nota" value="4"/>
              <label for="s4" title="4 estrelas">★</label>
              <input type="radio" id="s3" name="nota" value="3"/>
              <label for="s3" title="3 estrelas">★</label>
              <input type="radio" id="s2" name="nota" value="2"/>
              <label for="s2" title="2 estrelas">★</label>
              <input type="radio" id="s1" name="nota" value="1"/>
              <label for="s1" title="1 estrela">★</label>
            </div>
            <textarea id="comentario-avaliacao"
              placeholder="Conte sua experiência com este produto (opcional)..."
              rows="3"
              style="width:100%;padding:8px 12px;border:1px solid var(--cinza-medio);
                     border-radius:var(--radius-sm);font-size:0.85rem;resize:vertical;">
            </textarea>
            <button class="btn-primario" id="btn-enviar-avaliacao"
              style="max-width:180px;margin-top:10px;padding:10px;">
              Enviar Avaliação
            </button>
          </div>
        ` : `
          <p style="font-size:0.85rem;color:#888;margin-bottom:16px;">
            <a href="/login" style="color:var(--azul-claro);">Faça login</a>
            para avaliar este produto.
          </p>
        `}
        <div id="lista-avaliacoes">Carregando avaliações...</div>
      </div>
    `;

    // Botão adicionar ao carrinho
    if (!esgotado) {
      document.getElementById('btn-adicionar-detalhe')
        ?.addEventListener('click', () => Carrinho.adicionar(p));
    }

    // Botão enviar avaliação
    document.getElementById('btn-enviar-avaliacao')
      ?.addEventListener('click', () => this.enviarAvaliacao());

    // Carrega avaliações
    this.carregarAvaliacoes();
  },

  async carregarAvaliacoes() {
    const container = document.getElementById('lista-avaliacoes');
    if (!container) return;
    try {
      const avaliacoes = await API.avaliacoesProduto(this.produto.id);
      if (avaliacoes.length === 0) {
        container.innerHTML = `
          <p style="color:#aaa;font-size:0.85rem;">
            Nenhuma avaliação ainda. Seja o primeiro!
          </p>`;
        return;
      }
      container.innerHTML = avaliacoes.map(a => `
        <div class="avaliacao-item">
          <div class="avaliacao-topo">
            <span class="avaliacao-autor">
              👤 ${a.usuarios?.nome || 'Usuário'}
            </span>
            <span class="avaliacao-data">${Utils.formatarData(a.created_at)}</span>
          </div>
          <div class="estrelas" style="margin-bottom:6px;">
            ${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}
          </div>
          ${a.comentario
            ? `<div class="avaliacao-comentario">${a.comentario}</div>`
            : ''}
        </div>
      `).join('');
    } catch {
      container.innerHTML = `<p style="color:#aaa;">Erro ao carregar avaliações.</p>`;
    }
  },

  async enviarAvaliacao() {
    const notaEl = document.querySelector('input[name="nota"]:checked');
    const comentario = document.getElementById('comentario-avaliacao')?.value.trim();
    const btn = document.getElementById('btn-enviar-avaliacao');

    if (!notaEl) {
      Toast.erro('Selecione uma nota de 1 a 5 estrelas.');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
      await API.criarAvaliacao({
        produto_id: this.produto.id,
        nota: parseInt(notaEl.value),
        comentario: comentario || null
      });
      Toast.sucesso('Avaliação enviada! Obrigado. ⭐');
      await this.carregarAvaliacoes();
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar Avaliação'; }
    }
  }
};

// ============================================================
// PÁGINA: LOGIN
// ============================================================
const PaginaLogin = {
  init() {
    const user = Utils.getLoggedUser();
    if (user) {
      window.location.href = user.role === 'admin'
        ? '/dashboard'
        : '/';
      return;
    }
    Loading.ocultar();
    this.bindEventos();
  },

  bindEventos() {
    document.getElementById('form-login')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.fazerLogin();
      });
  },

  async fazerLogin() {
    const email  = document.getElementById('email')?.value.trim();
    const senha  = document.getElementById('senha')?.value;
    const btn    = document.getElementById('btn-login');

    if (!email || !senha) { Toast.erro('Preencha e-mail e senha.'); return; }

    btn.disabled = true;
    btn.textContent = 'Autenticando...';
    Loading.mostrar('Autenticando...');

    try {
      const resp = await API.login(email, senha);
      Utils.setToken(resp.token);
      Utils.setLoggedUser(resp.user);
      Toast.sucesso('Login realizado! Redirecionando...');
      setTimeout(() => {
        window.location.href = resp.user.role === 'admin'
          ? '/dashboard'
          : '/';
      }, 800);
    } catch (err) {
      Toast.erro(err.message);
      btn.disabled = false;
      btn.textContent = 'Entrar';
      Loading.ocultar();
    }
  }
};

// ============================================================
// PÁGINA: CADASTRO
// ============================================================
const PaginaCadastro = {
  init() {
    Loading.ocultar();
    this.bindEventos();
  },

  bindEventos() {
    // Máscara telefone
    document.getElementById('telefone')?.addEventListener('input', function () {
      this.value = Utils.formatarTelefone(this.value);
    });

    // Máscara CEP
    document.getElementById('cep')?.addEventListener('input', function () {
      this.value = Utils.formatarCEP(this.value);
    });

    // Busca CEP
    document.getElementById('btn-buscar-cep')
      ?.addEventListener('click', () => this.buscarCEP());

    document.getElementById('cep')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.buscarCEP(); }
    });

    // Submit
    document.getElementById('form-cadastro')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.fazerCadastro();
      });
  },

  async buscarCEP() {
    const cep     = document.getElementById('cep')?.value;
    const preview = document.getElementById('cep-preview');
    const cidadeEl = document.getElementById('cidade');
    const estadoEl = document.getElementById('estado');
    const enderecoEl = document.getElementById('endereco');

    if (!cep || cep.replace(/\D/g, '').length < 8) {
      Toast.erro('CEP inválido.');
      return;
    }

    if (preview) preview.textContent = 'Buscando...';

    try {
      const dados = await CEP.buscar(cep);
      if (cidadeEl) cidadeEl.value = dados.localidade;
      if (estadoEl) estadoEl.value = dados.uf;
      if (enderecoEl && !enderecoEl.value) enderecoEl.value = dados.logradouro || '';
      if (preview) {
        preview.textContent = `📍 ${dados.localidade} — ${dados.uf}`;
      }
      Toast.sucesso(`CEP encontrado: ${dados.localidade} - ${dados.uf}`);
    } catch (err) {
      if (preview) preview.textContent = '';
      Toast.erro(err.message);
    }
  },

  async fazerCadastro() {
    const campos = {
      nome:           document.getElementById('nome')?.value.trim(),
      email:          document.getElementById('email')?.value.trim(),
      senha:          document.getElementById('senha')?.value,
      confirmarSenha: document.getElementById('confirmar-senha')?.value,
      telefone:       document.getElementById('telefone')?.value.trim(),
      data_nascimento: document.getElementById('data_nascimento')?.value,
      cep:            document.getElementById('cep')?.value,
      endereco:       document.getElementById('endereco')?.value.trim(),
      numero_casa:    document.getElementById('numero_casa')?.value.trim(),
      cidade:         document.getElementById('cidade')?.value.trim(),
      estado:         document.getElementById('estado')?.value.trim()
    };

    // Validações frontend
    if (Object.values(campos).some(v => !v)) {
      Toast.erro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (campos.senha.length < 6) {
      Toast.erro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (campos.senha !== campos.confirmarSenha) {
      Toast.erro('As senhas não coincidem.');
      return;
    }
    if (!campos.cidade || !campos.estado) {
      Toast.erro('Busque o CEP para preencher cidade e estado.');
      return;
    }

    const btn = document.getElementById('btn-cadastro');
    btn.disabled = true;
    btn.textContent = 'Cadastrando...';
    Loading.mostrar('Criando sua conta...');

    try {
      await API.register({
        nome:            campos.nome,
        email:           campos.email,
        senha:           campos.senha,
        telefone:        campos.telefone,
        data_nascimento: campos.data_nascimento,
        cep:             campos.cep,
        endereco:        campos.endereco,
        numero_casa:     campos.numero_casa,
        cidade:          campos.cidade,
        estado:          campos.estado
      });

      Toast.sucesso('Conta criada com sucesso! Faça login. 🎣');
      setTimeout(() => window.location.href = '/login', 1500);
    } catch (err) {
      Toast.erro(err.message);
      btn.disabled = false;
      btn.textContent = 'Criar conta';
      Loading.ocultar();
    }
  }
};

// ============================================================
// PÁGINA: MEUS PEDIDOS
// ============================================================
const PaginaMeusPedidos = {
  async init() {
    const user = Utils.getLoggedUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    NavAuth.render();
    Loading.mostrar('Carregando seus pedidos...');
    try {
      const pedidos = await API.meusPedidos();
      this.renderizar(pedidos);
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      Loading.ocultar();
    }
  },

  renderizar(pedidos) {
    const container = document.getElementById('lista-pedidos');
    if (!container) return;

    if (pedidos.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#aaa;">
          <div style="font-size:3rem;margin-bottom:12px;">📦</div>
          <h3>Nenhum pedido ainda.</h3>
          <p style="margin-top:8px;">
            <a href="/" style="color:var(--azul-claro);">
              Comece a explorar nossa loja!
            </a>
          </p>
        </div>`;
      return;
    }

    container.innerHTML = pedidos.map(p => {
      const passos = ['pago','em_preparo','enviado','entregue'];
      const idxAtual = passos.indexOf(p.status);

      const progressoHtml = p.status !== 'pendente' && p.status !== 'cancelado'
        ? `<div class="linha-progresso">
            ${[
              { key:'pago',       icon:'✅', label:'Pago' },
              { key:'em_preparo', icon:'📦', label:'Em preparo' },
              { key:'enviado',    icon:'🚚', label:'Enviado' },
              { key:'entregue',   icon:'🏠', label:'Entregue' }
            ].map((passo, idx) => `
              <div class="passo-status
                ${idx <= idxAtual ? 'completo' : ''}
                ${idx === idxAtual ? 'ativo' : ''}">
                <div class="circulo">${passo.icon}</div>
                <span>${passo.label}</span>
              </div>
            `).join('')}
          </div>`
        : '';

      return `
        <div class="pedido-card">
          <div class="pedido-header">
            <div>
              <div style="font-weight:700;">Pedido #${p.id.slice(0,8).toUpperCase()}</div>
              <div class="pedido-data">${Utils.formatarData(p.created_at)}</div>
            </div>
            <span class="badge-status status-${p.status}">
              ${Utils.labelStatus(p.status)}
            </span>
          </div>
          ${progressoHtml}
          <div class="pedido-body">
            <ul class="pedido-itens-lista">
              ${(p.pedido_itens || []).map(item => `
                <li>
                  <span>${item.nome_produto} × ${item.quantidade}</span>
                  <span>${Utils.formatarMoeda(item.subtotal)}</span>
                </li>
              `).join('')}
            </ul>
            ${p.desconto > 0 ? `
              <div style="display:flex;justify-content:space-between;
                font-size:0.82rem;color:#27ae60;">
                <span>Desconto</span>
                <span>-${Utils.formatarMoeda(p.desconto)}</span>
              </div>` : ''}
            ${p.frete > 0 ? `
              <div style="display:flex;justify-content:space-between;
                font-size:0.82rem;color:var(--cinza-escuro);">
                <span>Frete</span>
                <span>${Utils.formatarMoeda(p.frete)}</span>
              </div>` : ''}
            <div class="pedido-total">
              <span>Total:</span>
              <span>${Utils.formatarMoeda(p.total)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
};

// ============================================================
// PÁGINA: FAVORITOS
// ============================================================
const PaginaFavoritos = {
  async init() {
    const user = Utils.getLoggedUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    NavAuth.render();
    Loading.mostrar('Carregando favoritos...');
    try {
      const favs = await API.meurosFavoritos();
      this.renderizar(favs);
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      Loading.ocultar();
    }
  },

  renderizar(produtos) {
    const grid = document.getElementById('grid-favoritos');
    if (!grid) return;

    if (produtos.length === 0) {
      grid.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#aaa;grid-column:1/-1;">
          <div style="font-size:3rem;margin-bottom:12px;">❤️</div>
          <h3>Nenhum favorito ainda.</h3>
          <p style="margin-top:8px;">
            <a href="/" style="color:var(--azul-claro);">
              Explore os produtos e salve seus favoritos!
            </a>
          </p>
        </div>`;
      return;
    }

    grid.innerHTML = produtos.map(p => {
      const esgotado = p.estoque === 0;
      return `
        <article class="card-produto ${esgotado ? 'esgotado' : ''}">
          <div class="card-img-wrapper">
            <img class="card-produto-img"
              src="${p.imagem_url || 'https://via.placeholder.com/400x300?text=🎣'}"
              alt="${p.nome}" loading="lazy"
              onerror="this.src='https://via.placeholder.com/400x300?text=🎣'"/>
            <span class="badge-categoria">${Utils.formatarCategoria(p.categoria)}</span>
            ${esgotado ? '<span class="badge-esgotado">Esgotado</span>' : ''}
          </div>
          <div class="card-body">
            <h3 class="card-nome">${p.nome}</h3>
            <div class="card-preco">${Utils.formatarMoeda(p.preco)}</div>
          </div>
          <div class="card-footer">
            <button class="btn-detalhes"
              onclick="window.location.href='produto.html?id=${p.id}'">
              Detalhes
            </button>
            <button class="btn-comprar" ${esgotado ? 'disabled' : ''}
              onclick="${esgotado ? '' : `Carrinho.adicionar(${JSON.stringify(p).replace(/"/g,'&quot;')})`}">
              ${esgotado ? 'Esgotado' : '🛒 Comprar'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }
};

// ============================================================
// PÁGINA: DASHBOARD ADMIN
// ============================================================
const PaginaDashboard = {
  produtos: [],
  usuarios: [],
  pedidos: [],
  cupons: [],
  secaoAtiva: 'produtos',
  idParaExcluir: null,

  async init() {
    const user = Utils.getLoggedUser();
    if (!user || user.role !== 'admin') {
      Utils.removeToken();
      window.location.href = '/login';
      return;
    }

    const emailEl = document.getElementById('admin-email');
    if (emailEl) emailEl.textContent = `👤 ${user.nome || user.email}`;

    Loading.mostrar('Carregando painel...');
    try {
      await Promise.all([
        this.carregarProdutos(),
        this.carregarUsuarios(),
        this.carregarPedidos(),
        this.carregarStats(),
        this.carregarCupons()
      ]);
    } finally {
      Loading.ocultar();
    }

    this.bindEventos();
    this.ativarSecao('produtos');
  },

  ativarSecao(secao) {
    this.secaoAtiva = secao;
    const secoes = ['produtos','usuarios','pedidos','cupons'];
    secoes.forEach(s => {
      const el = document.getElementById(`secao-${s}`);
      const nav = document.getElementById(`nav-${s}`);
      if (el)  el.style.display  = s === secao ? 'block' : 'none';
      if (nav) nav.classList.toggle('ativo', s === secao);
    });
    const titulos = {
      produtos: '📦 Gerenciar Produtos',
      usuarios: '👥 Gerenciar Usuários',
      pedidos:  '🛒 Gerenciar Pedidos',
      cupons:   '🎟️ Cupons de Desconto'
    };
    const tituloEl = document.getElementById('admin-page-title');
    if (tituloEl) tituloEl.textContent = titulos[secao] || 'Dashboard';
  },

  async carregarStats() {
    try {
      const stats = await API.statsAdmin();
      const el = id => document.getElementById(id);
      if (el('stat-total'))      el('stat-total').textContent     = stats.total_produtos;
      if (el('stat-usuarios'))   el('stat-usuarios').textContent  = stats.total_usuarios;
      if (el('stat-vendas'))     el('stat-vendas').textContent    = Utils.formatarMoeda(stats.total_vendas);
      if (el('stat-categorias')) {
        const cats = new Set(this.produtos.map(p => p.categoria)).size;
        el('stat-categorias').textContent = cats;
      }

      const maisVendidosEl = document.getElementById('mais-vendidos-lista');
      if (maisVendidosEl && stats.mais_vendidos?.length > 0) {
        maisVendidosEl.innerHTML = stats.mais_vendidos.map((p, i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
            border-bottom:1px solid var(--cinza-claro);">
            <span style="font-weight:800;color:var(--azul-claro);
              min-width:20px;">${i + 1}.</span>
            <img src="${p.imagem_url || 'https://via.placeholder.com/36?text=🎣'}"
              style="width:36px;height:36px;border-radius:6px;object-fit:cover;"/>
            <span style="flex:1;font-size:0.85rem;">${p.nome}</span>
            <span style="font-size:0.8rem;color:#888;">${p.vendas} vendas</span>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  },

  async carregarProdutos() {
    try {
      this.produtos = await API.listarProdutos();
      this.renderizarTabelaProdutos();
    } catch (err) {
      Toast.erro(err.message);
    }
  },

  async carregarUsuarios() {
    try {
      this.usuarios = await API.listUsers();
      this.renderizarTabelaUsuarios();
    } catch (err) {
      Toast.erro(err.message);
    }
  },

  async carregarPedidos() {
    try {
      this.pedidos = await API.todosPedidos();
      this.renderizarTabelaPedidos();
    } catch (err) {
      Toast.erro(err.message);
    }
  },

  async carregarCupons() {
    try {
      this.cupons = await API.listarCupons();
      this.renderizarTabelaCupons();
    } catch (err) {
      Toast.erro(err.message);
    }
  },

  renderizarTabelaProdutos() {
    const tbody = document.getElementById('tabela-body-produtos');
    if (!tbody) return;

    if (this.produtos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"
        style="text-align:center;padding:32px;color:#888;">
        Nenhum produto cadastrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.produtos.map(p => `
      <tr>
        <td>
          <img class="tabela-img"
            src="${p.imagem_url || 'https://via.placeholder.com/44?text=🎣'}"
            alt="${p.nome}"
            onerror="this.src='https://via.placeholder.com/44?text=🎣'"/>
        </td>
        <td style="font-weight:600;">${p.nome}</td>
        <td>${Utils.formatarCategoria(p.categoria)}</td>
        <td style="color:#1e8449;font-weight:700;">${Utils.formatarMoeda(p.preco)}</td>
        <td>
          <span style="font-weight:700;color:${p.estoque === 0 ? '#e74c3c' : p.estoque <= 3 ? '#f39c12' : '#27ae60'};">
            ${p.estoque === 0 ? '⚠️ Esgotado' : p.estoque + ' un.'}
          </span>
        </td>
        <td>
          <button class="btn-acao btn-editar"
            onclick="PaginaDashboard.editarProduto('${p.id}')">✏️ Editar</button>
          <button class="btn-acao btn-excluir"
            onclick="PaginaDashboard.abrirModalExcluir('${p.id}',
            '${p.nome.replace(/'/g,"\\'")}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  },

  renderizarTabelaUsuarios() {
    const tbody = document.getElementById('tabela-body-usuarios');
    if (!tbody) return;
    const loggedUser = Utils.getLoggedUser();

    if (this.usuarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4"
        style="text-align:center;padding:32px;color:#888;">
        Nenhum usuário cadastrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.usuarios.map(u => `
      <tr>
        <td>
          <div style="font-weight:600;">${u.nome || '—'}</div>
          <div style="font-size:0.75rem;color:#888;">${u.email}</div>
        </td>
        <td>${u.telefone || '—'}</td>
        <td>
          <select class="select-status-pedido" id="select-role-${u.id}"
            onchange="PaginaDashboard.habilitarSalvarRole('${u.id}')"
            ${loggedUser?.id === u.id ? 'disabled' : ''}>
            <option value="user"  ${u.role === 'user'  ? 'selected' : ''}>Usuário</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td>
          <button class="btn-salvar-role" id="btn-role-${u.id}"
            onclick="PaginaDashboard.salvarRole('${u.id}')" disabled
            ${loggedUser?.id === u.id ? 'title="Não pode alterar seu próprio papel"' : ''}>
            Salvar
          </button>
        </td>
      </tr>
    `).join('');
  },

  renderizarTabelaPedidos() {
    const tbody = document.getElementById('tabela-body-pedidos');
    if (!tbody) return;

    if (this.pedidos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"
        style="text-align:center;padding:32px;color:#888;">
        Nenhum pedido ainda.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.pedidos.map(p => {
      const totalItens = (p.pedido_itens || [])
        .reduce((a, i) => a + i.quantidade, 0);

      return `
        <tr>
          <td style="font-family:monospace;font-size:0.82rem;">
            #${p.id.slice(0,8).toUpperCase()}
          </td>
          <td>
            <div style="font-weight:600;">${p.usuarios?.nome || '—'}</div>
            <div style="font-size:0.75rem;color:#888;">${p.usuarios?.email || ''}</div>
          </td>
          <td style="font-weight:700;color:#1e8449;">${Utils.formatarMoeda(p.total)}</td>
          <td>${Utils.formatarData(p.created_at)}</td>
          <td>
            <select class="select-status-pedido" id="select-status-${p.id}"
              onchange="PaginaDashboard.salvarStatusPedido('${p.id}')">
              ${['pendente','pago','em_preparo','enviado','entregue','cancelado'].map(s => `
                <option value="${s}" ${p.status === s ? 'selected' : ''}>
                  ${Utils.labelStatus(s)}
                </option>
              `).join('')}
            </select>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderizarTabelaCupons() {
    const tbody = document.getElementById('tabela-body-cupons');
    if (!tbody) return;

    if (this.cupons.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"
        style="text-align:center;padding:32px;color:#888;">
        Nenhum cupom cadastrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.cupons.map(c => `
      <tr>
        <td style="font-weight:700;font-family:monospace;">${c.codigo}</td>
        <td style="color:#27ae60;font-weight:700;">
          ${c.desconto_percent
            ? `${c.desconto_percent}%`
            : Utils.formatarMoeda(c.desconto_fixo)}
        </td>
        <td>${c.valor_minimo > 0
          ? Utils.formatarMoeda(c.valor_minimo) : 'Sem mínimo'}</td>
        <td>${c.validade
          ? new Date(c.validade).toLocaleDateString('pt-BR') : 'Sem vencimento'}</td>
        <td>${c.usos}${c.limite_uso ? ` / ${c.limite_uso}` : ''}</td>
      </tr>
    `).join('');
  },

  habilitarSalvarRole(userId) {
    const btn = document.getElementById(`btn-role-${userId}`);
    if (btn) btn.disabled = false;
  },

  async salvarRole(userId) {
    const select = document.getElementById(`select-role-${userId}`);
    const btn    = document.getElementById(`btn-role-${userId}`);
    if (!select) return;

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      await API.updateRole(userId, select.value);
      Toast.sucesso('Papel atualizado!');
      await this.carregarUsuarios();
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar';
    }
  },

  async salvarStatusPedido(pedidoId) {
    const select = document.getElementById(`select-status-${pedidoId}`);
    if (!select) return;

    try {
      await API.atualizarStatus(pedidoId, select.value);
      Toast.sucesso('Status do pedido atualizado!');
    } catch (err) {
      Toast.erro(err.message);
      await this.carregarPedidos();
    }
  },

  editarProduto(id) {
    const p = this.produtos.find(x => x.id === id);
    if (!p) return;

    const set = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) el.value = val ?? '';
    };

    set('produto-id',        p.id);
    set('produto-nome',      p.nome);
    set('produto-categoria', p.categoria);
    set('produto-preco',     p.preco);
    set('produto-estoque',   p.estoque);
    set('produto-imagem',    p.imagem_url || '');
    set('produto-descricao', p.descricao || '');

    const titulo    = document.getElementById('titulo-form');
    const btnCancel = document.getElementById('btn-cancelar-edicao');

    if (titulo)    titulo.textContent = '✏️ Editando Produto';
    if (btnCancel) btnCancel.style.display = 'inline-flex';

    document.getElementById('form-produto')?.scrollIntoView({ behavior: 'smooth' });
  },

  cancelarEdicao() {
    document.getElementById('form-produto')?.reset();
    document.getElementById('produto-id').value = '';

    const titulo    = document.getElementById('titulo-form');
    const btnCancel = document.getElementById('btn-cancelar-edicao');

    if (titulo)    titulo.textContent = '➕ Novo Produto';
    if (btnCancel) btnCancel.style.display = 'none';
  },

  abrirModalExcluir(id, nome) {
    this.idParaExcluir = id;
    const modal  = document.getElementById('modal-excluir');
    const nomeEl = document.getElementById('modal-produto-nome');
    if (nomeEl) nomeEl.textContent = nome;
    if (modal)  modal.classList.add('ativo');
  },

  fecharModal() {
    document.getElementById('modal-excluir')?.classList.remove('ativo');
    this.idParaExcluir = null;
  },

  async confirmarExclusao() {
    if (!this.idParaExcluir) return;
    const btn = document.getElementById('btn-confirmar-excluir');
    if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }

    try {
      await API.deletarProduto(this.idParaExcluir);
      Toast.sucesso('Produto excluído!');
      this.fecharModal();
      await this.carregarProdutos();
      await this.carregarStats();
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sim, Excluir'; }
    }
  },

  async salvarProduto(e) {
    e.preventDefault();
    const id        = document.getElementById('produto-id')?.value;
    const nome      = document.getElementById('produto-nome')?.value.trim();
    const categoria = document.getElementById('produto-categoria')?.value;
    const preco     = document.getElementById('produto-preco')?.value;
    const estoque   = document.getElementById('produto-estoque')?.value;
    const imagemUrl = document.getElementById('produto-imagem')?.value.trim();
    const descricao = document.getElementById('produto-descricao')?.value.trim();

    if (!nome || !categoria || !preco || estoque === undefined) {
      Toast.erro('Preencha nome, categoria, preço e estoque.');
      return;
    }
    if (parseFloat(preco) <= 0) { Toast.erro('Preço inválido.'); return; }
    if (parseInt(estoque) < 0)  { Toast.erro('Estoque inválido.'); return; }

    const btn = document.getElementById('btn-salvar-produto');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    const dados = {
      nome, categoria, preco: parseFloat(preco), estoque: parseInt(estoque), descricao
    };
    if (imagemUrl) dados.imagem_url = imagemUrl;

    try {
      if (id) {
        await API.atualizarProduto(id, dados);
        Toast.sucesso('Produto atualizado!');
        this.cancelarEdicao();
      } else {
        await API.criarProduto(dados);
        Toast.sucesso('Produto criado!');
        document.getElementById('form-produto')?.reset();
      }
      await this.carregarProdutos();
      await this.carregarStats();
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Produto'; }
    }
  },

  async salvarCupom(e) {
    e.preventDefault();
    const codigo         = document.getElementById('cupom-codigo')?.value.trim();
    const desconto_percent = document.getElementById('cupom-desconto-percent')?.value;
    const desconto_fixo  = document.getElementById('cupom-desconto-fixo')?.value;
    const valor_minimo   = document.getElementById('cupom-valor-minimo')?.value;
    const validade       = document.getElementById('cupom-validade')?.value;
    const limite_uso     = document.getElementById('cupom-limite-uso')?.value;

    if (!codigo) { Toast.erro('Código do cupom é obrigatório.'); return; }
    if (!desconto_percent && !desconto_fixo) {
      Toast.erro('Informe desconto em % ou valor fixo.'); return;
    }
    if (desconto_percent && (parseFloat(desconto_percent) <= 0 || parseFloat(desconto_percent) > 100)) {
      Toast.erro('Desconto % inválido.'); return;
    }
    if (desconto_fixo && parseFloat(desconto_fixo) <= 0) {
      Toast.erro('Desconto fixo inválido.'); return;
    }

    const btn = document.getElementById('btn-salvar-cupom');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    const dados = {
      codigo,
      desconto_percent: desconto_percent ? parseFloat(desconto_percent) : null,
      desconto_fixo:    desconto_fixo ? parseFloat(desconto_fixo) : null,
      valor_minimo:     valor_minimo ? parseFloat(valor_minimo) : 0,
      validade:         validade || null,
      limite_uso:       limite_uso ? parseInt(limite_uso) : null
    };

    try {
      await API.criarCupom(dados);
      Toast.sucesso('Cupom criado!');
      document.getElementById('form-cupom')?.reset();
      await this.carregarCupons();
    } catch (err) {
      Toast.erro(err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Criar Cupom'; }
    }
  },

  bindEventos() {
    // Navegação entre seções
    document.getElementById('nav-produtos')?.addEventListener('click', (e) => {
      e.preventDefault(); this.ativarSecao('produtos');
    });
    document.getElementById('nav-usuarios')?.addEventListener('click', (e) => {
      e.preventDefault(); this.ativarSecao('usuarios');
    });
    document.getElementById('nav-pedidos')?.addEventListener('click', (e) => {
      e.preventDefault(); this.ativarSecao('pedidos');
    });
    document.getElementById('nav-cupons')?.addEventListener('click', (e) => {
      e.preventDefault(); this.ativarSecao('cupons');
    });

    // Form produto
    document.getElementById('form-produto')?.addEventListener('submit', (e) => this.salvarProduto(e));
    document.getElementById('btn-cancelar-edicao')?.addEventListener('click', () => this.cancelarEdicao());

    // Form cupom
    document.getElementById('form-cupom')?.addEventListener('submit', (e) => this.salvarCupom(e));

    // Modal
    document.getElementById('btn-fechar-modal')?.addEventListener('click',  () => this.fecharModal());
    document.getElementById('btn-cancelar-excluir')?.addEventListener('click', () => this.fecharModal());
    document.getElementById('btn-confirmar-excluir')?.addEventListener('click', () => this.confirmarExclusao());
    document.getElementById('modal-excluir')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-excluir')) this.fecharModal();
    });

    // Sair
    document.getElementById('btn-sair')?.addEventListener('click', () => {
      Utils.removeToken();
      window.location.href = '/login';
    });
  }
};

// ============================================================
// ROUTER
// ============================================================
const Router = {
  init() {
    Loading.init();
    Toast.init();

    const path  = window.location.pathname;
    // Remove a barra inicial e o .html se existir, para obter a "página limpa"
    const pagina = path === '/' ? '/' : path.substring(1).replace(/\.html$/, '');

    if (pagina === '/' || pagina === 'index') { // 'index' para compatibilidade se alguém digitar index.html
      const user = Utils.getLoggedUser();
      if (user && user.role === 'admin') {
        window.location.href = '/dashboard'; // Alterado
        return;
      }
      Carrinho.init();
      MenuMobile.init();
      PaginaLoja.init();

    } else if (pagina === 'produto') { // produto.html?id=...
      Carrinho.init();
      MenuMobile.init();
      PaginaDetalhe.init();

    } else if (pagina === 'login') { // Alterado
      PaginaLogin.init();

    } else if (pagina === 'cadastro') { // Alterado
      PaginaCadastro.init();

    } else if (pagina === 'dashboard') { // Alterado
      PaginaDashboard.init();

    } else if (pagina === 'pedidos') { // Alterado
      MenuMobile.init();
      PaginaMeusPedidos.init();

    } else if (pagina === 'favoritos') { // Alterado
      MenuMobile.init();
      PaginaFavoritos.init();

    } else {
      Loading.ocultar();
    }
  }
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  Router.init();
});
