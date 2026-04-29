const supabase = require('../config/supabase');

async function listarProdutos(req, res) {
  try {
    const { categoria, preco_min, preco_max, busca, ordenar } = req.query;

    let query = supabase
      .from('produtos')
      .select(`
        id, nome, descricao, preco, imagem_url,
        categoria, estoque, vendas, ativo,
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

    const produtosComMedia = data.map(p => {
      const notas = p.avaliacoes || [];
      const media = notas.length > 0
        ? notas.reduce((a, b) => a + b.nota, 0) / notas.length
        : 0;
      const { avaliacoes, ...produto } = p;
      return {
        ...produto,
        media_avaliacao: parseFloat(media.toFixed(1)),
        total_avaliacoes: notas.length
      };
    });

    return res.status(200).json(produtosComMedia);
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    return res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
}

async function obterProduto(req, res) {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('produtos')
      .select(`
        id, nome, descricao, preco, imagem_url,
        categoria, estoque, vendas, ativo, created_at,
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
      media_avaliacao: parseFloat(media.toFixed(1)),
      total_avaliacoes: notas.length
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

async function criarProduto(req, res) {
  const { nome, descricao, preco, imagem_url, categoria, estoque } = req.body;

  if (!nome || !preco || !categoria) {
    return res.status(400).json({ erro: 'Nome, preço e categoria são obrigatórios.' });
  }
  if (isNaN(preco) || parseFloat(preco) <= 0) {
    return res.status(400).json({ erro: 'Preço inválido.' });
  }
  if (estoque !== undefined && (isNaN(estoque) || parseInt(estoque) < 0)) {
    return res.status(400).json({ erro: 'Estoque inválido.' });
  }

  try {
    const { data, error } = await supabase
      .from('produtos')
      .insert([{
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        preco: parseFloat(preco),
        imagem_url: imagem_url || null,
        categoria: categoria.trim(),
        estoque: parseInt(estoque) || 0
      }])
      .select()
      .single();

    if (error) throw error;

    await registrarLog(req.user.id, 'CRIAR_PRODUTO', 'produtos', data.id, { nome }, req.ip);
    return res.status(201).json({ mensagem: 'Produto criado.', produto: data });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar produto.' });
  }
}

async function atualizarProduto(req, res) {
  const { id } = req.params;
  const { nome, descricao, preco, imagem_url, categoria, estoque, ativo } = req.body;

  const updates = {};
  if (nome !== undefined) updates.nome = nome.trim();
  if (descricao !== undefined) updates.descricao = descricao.trim();
  if (preco !== undefined) updates.preco = parseFloat(preco);
  if (imagem_url !== undefined) updates.imagem_url = imagem_url;
  if (categoria !== undefined) updates.categoria = categoria.trim();
  if (estoque !== undefined) updates.estoque = parseInt(estoque);
  if (ativo !== undefined) updates.ativo = ativo;

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

    await registrarLog(req.user.id, 'ATUALIZAR_PRODUTO', 'produtos', id, updates, req.ip);
    return res.status(200).json({ mensagem: 'Produto atualizado.', produto: data });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
}

async function deletarProduto(req, res) {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('produtos')
      .update({ ativo: false })
      .eq('id', id);

    if (error) throw error;
    await registrarLog(req.user.id, 'DELETAR_PRODUTO', 'produtos', id, {}, req.ip);
    return res.status(200).json({ mensagem: 'Produto removido.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao remover produto.' });
  }
}

async function registrarLog(adminId, acao, entidade, entidadeId, detalhes, ip) {
  try {
    await supabase.from('admin_logs').insert([{
      admin_id: adminId, acao, entidade,
      entidade_id: entidadeId, detalhes, ip
    }]);
  } catch {}
}

module.exports = { listarProdutos, obterProduto, criarProduto, atualizarProduto, deletarProduto };