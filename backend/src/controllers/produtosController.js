const supabase = require('../config/supabase');

// 🔥 Função helper (PADRONIZA imagens)
function normalizarImagens(p) {
  if (Array.isArray(p.imagens) && p.imagens.length > 0) {
    return p.imagens;
  }
  if (p.imagem_url) {
    return [p.imagem_url];
  }
  return [];
}

// =========================
// LISTAR PRODUTOS
// =========================
async function listarProdutos(req, res) {
  try {
    const { categoria, preco_min, preco_max, busca, ordenar } = req.query;

    let query = supabase
      .from('produtos')
      .select(`
        id, nome, descricao, preco, imagem_url,
        categoria, estoque, vendas, ativo,
        cores, imagens, especificacoes, info_frete, info_seguranca,
        avaliacoes(nota)
      `)
      .eq('ativo', true);

    if (categoria && categoria !== 'todos') query = query.eq('categoria', categoria);
    if (preco_min) query = query.gte('preco', parseFloat(preco_min));
    if (preco_max) query = query.lte('preco', parseFloat(preco_max));
    if (busca) query = query.ilike('nome', `%${busca}%`);

    if (ordenar === 'preco_asc') query = query.order('preco', { ascending: true });
    else if (ordenar === 'preco_desc') query = query.order('preco', { ascending: false });
    else if (ordenar === 'mais_vendidos') query = query.order('vendas', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const produtos = data.map(p => {
      const notas = p.avaliacoes || [];
      const media = notas.length > 0
        ? notas.reduce((a, b) => a + b.nota, 0) / notas.length
        : 0;

      const { avaliacoes, ...produto } = p;

      return {
        ...produto,
        imagens: normalizarImagens(p), // 🔥 PADRÃO GARANTIDO
        media_avaliacao: parseFloat(media.toFixed(1)),
        total_avaliacoes: notas.length
      };
    });

    return res.status(200).json(produtos);
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    return res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
}

// =========================
// OBTER PRODUTO
// =========================
async function obterProduto(req, res) {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('produtos')
      .select(`
        id, nome, descricao, preco, imagem_url,
        categoria, estoque, vendas, ativo, created_at,
        cores, imagens, especificacoes, info_frete, info_seguranca,
        avaliacoes(
          id, nota, comentario, created_at,
          usuarios(nome)
        )
      `)
      .eq('id', id)
      .eq('ativo', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const notas = data.avaliacoes || [];
    const media = notas.length > 0
      ? notas.reduce((a, b) => a + b.nota, 0) / notas.length
      : 0;

    return res.status(200).json({
      ...data,
      imagens: normalizarImagens(data), // 🔥 PADRÃO
      media_avaliacao: parseFloat(media.toFixed(1)),
      total_avaliacoes: notas.length
    });
  } catch (err) {
    console.error('Erro ao obter produto:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

// =========================
// CRIAR PRODUTO
// =========================
async function criarProduto(req, res) {
  const {
    nome, descricao, preco, imagem_url, categoria, estoque,
    cores, imagens, especificacoes, info_frete, info_seguranca
  } = req.body;

  if (!nome || !preco || !categoria) {
    return res.status(400).json({ erro: 'Nome, preço e categoria são obrigatórios.' });
  }

  if (isNaN(preco) || parseFloat(preco) <= 0) {
    return res.status(400).json({ erro: 'Preço inválido.' });
  }

  if (estoque !== undefined && (isNaN(estoque) || parseInt(estoque) < 0)) {
    return res.status(400).json({ erro: 'Estoque inválido.' });
  }

  // 🔥 Normalização das imagens
  const imagensArray = Array.isArray(imagens) && imagens.length > 0
    ? imagens
    : (imagem_url ? [imagem_url] : []);

  if (imagensArray.length === 0) {
    return res.status(400).json({ erro: 'Pelo menos uma imagem é obrigatória.' });
  }

  try {
    const { data, error } = await supabase
      .from('produtos')
      .insert([{
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        preco: parseFloat(preco),
        imagem_url: imagensArray[0], // 🔥 sempre primeira imagem
        categoria: categoria.trim(),
        estoque: parseInt(estoque) || 0,
        cores: cores || [],
        imagens: imagensArray,
        especificacoes: especificacoes || {},
        info_frete: info_frete || {},
        info_seguranca: info_seguranca || {}
      }])
      .select()
      .single();

    if (error) throw error;

    await registrarLog(req.user?.id, 'CRIAR_PRODUTO', 'produtos', data.id, { nome }, req.ip);

    return res.status(201).json({
      mensagem: 'Produto criado.',
      produto: {
        ...data,
        imagens: normalizarImagens(data)
      }
    });

  } catch (err) {
    console.error('Erro ao criar produto:', err);
    return res.status(500).json({ erro: 'Erro ao criar produto.' });
  }
}

// =========================
// ATUALIZAR PRODUTO
// =========================
async function atualizarProduto(req, res) {
  const { id } = req.params;

  const {
    nome, descricao, preco, imagem_url, categoria, estoque, ativo,
    cores, imagens, especificacoes, info_frete, info_seguranca
  } = req.body;

  const updates = {};

  if (nome !== undefined) updates.nome = nome.trim();
  if (descricao !== undefined) updates.descricao = descricao.trim();
  if (preco !== undefined) updates.preco = parseFloat(preco);
  if (categoria !== undefined) updates.categoria = categoria.trim();
  if (estoque !== undefined) updates.estoque = parseInt(estoque);
  if (ativo !== undefined) updates.ativo = ativo;

  if (cores !== undefined) updates.cores = cores;
  if (especificacoes !== undefined) updates.especificacoes = especificacoes;
  if (info_frete !== undefined) updates.info_frete = info_frete;
  if (info_seguranca !== undefined) updates.info_seguranca = info_seguranca;

  // 🔥 tratamento de imagens
  if (imagens !== undefined) {
    const imagensArray = Array.isArray(imagens) ? imagens : [];

    updates.imagens = imagensArray;
    updates.imagem_url = imagensArray.length > 0 ? imagensArray[0] : null;
  } else if (imagem_url !== undefined) {
    updates.imagem_url = imagem_url;
    updates.imagens = imagem_url ? [imagem_url] : [];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
  }

  try {
    const { data, error } = await supabase
      .from('produtos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    await registrarLog(req.user?.id, 'ATUALIZAR_PRODUTO', 'produtos', id, updates, req.ip);

    return res.status(200).json({
      mensagem: 'Produto atualizado.',
      produto: {
        ...data,
        imagens: normalizarImagens(data)
      }
    });

  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
}

// =========================
// DELETAR PRODUTO
// =========================
async function deletarProduto(req, res) {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('produtos')
      .update({ ativo: false })
      .eq('id', id);

    if (error) throw error;

    await registrarLog(req.user?.id, 'DELETAR_PRODUTO', 'produtos', id, {}, req.ip);

    return res.status(200).json({ mensagem: 'Produto removido.' });

  } catch (err) {
    console.error('Erro ao deletar produto:', err);
    return res.status(500).json({ erro: 'Erro ao remover produto.' });
  }
}

// =========================
// LOG ADMIN
// =========================
async function registrarLog(adminId, acao, entidade, entidadeId, detalhes, ip) {
  if (!adminId) return;

  try {
    await supabase.from('admin_logs').insert([{
      admin_id: adminId,
      acao,
      entidade,
      entidade_id: entidadeId,
      detalhes,
      ip
    }]);
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
}

module.exports = {
  listarProdutos,
  obterProduto,
  criarProduto,
  atualizarProduto,
  deletarProduto
};