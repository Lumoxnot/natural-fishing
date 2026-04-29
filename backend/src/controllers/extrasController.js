const supabase = require('../config/supabase');

// ===== AVALIAÇÕES =====

async function criarAvaliacao(req, res) {
  const { produto_id, nota, comentario } = req.body;
  const usuarioId = req.user.id;

  if (!produto_id || !nota || nota < 1 || nota > 5) {
    return res.status(400).json({ erro: 'Produto e nota (1-5) são obrigatórios.' });
  }

  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .upsert([{
        usuario_id: usuarioId,
        produto_id,
        nota: parseInt(nota),
        comentario: comentario?.trim() || null
      }], { onConflict: 'usuario_id,produto_id' })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ mensagem: 'Avaliação salva!', avaliacao: data });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao salvar avaliação.' });
  }
}

async function listarAvaliacoesProduto(req, res) {
  const { produto_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('id, nota, comentario, created_at, usuarios(nome)')
      .eq('produto_id', produto_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar avaliações.' });
  }
}

// ===== FAVORITOS =====

async function toggleFavorito(req, res) {
  const { produto_id } = req.body;
  const usuarioId = req.user.id;

  if (!produto_id) {
    return res.status(400).json({ erro: 'produto_id obrigatório.' });
  }

  try {
    const { data: existente } = await supabase
      .from('favoritos')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('produto_id', produto_id)
      .single();

    if (existente) {
      await supabase.from('favoritos').delete().eq('id', existente.id);
      return res.status(200).json({ mensagem: 'Removido dos favoritos.', favoritado: false });
    } else {
      await supabase.from('favoritos').insert([{ usuario_id: usuarioId, produto_id }]);
      return res.status(200).json({ mensagem: 'Adicionado aos favoritos!', favoritado: true });
    }
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao atualizar favoritos.' });
  }
}

async function listarFavoritos(req, res) {
  try {
    const { data, error } = await supabase
      .from('favoritos')
      .select('produto_id, produtos(id, nome, preco, imagem_url, categoria, estoque)')
      .eq('usuario_id', req.user.id);

    if (error) throw error;
    return res.status(200).json(data.map(f => f.produtos));
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar favoritos.' });
  }
}

// ===== NOTIFICAÇÕES =====

async function listarNotificacoes(req, res) {
  try {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar notificações.' });
  }
}

async function marcarNotificacaoLida(req, res) {
  const { id } = req.params;
  try {
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)
      .eq('usuario_id', req.user.id);

    return res.status(200).json({ mensagem: 'Notificação marcada como lida.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

async function marcarTodasLidas(req, res) {
  try {
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('usuario_id', req.user.id);

    return res.status(200).json({ mensagem: 'Todas marcadas como lidas.' });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

// ===== CUPONS =====

async function validarCupom(req, res) {
  const { codigo, subtotal } = req.body;
  if (!codigo) return res.status(400).json({ erro: 'Código do cupom obrigatório.' });

  try {
    const { data: cupom } = await supabase
      .from('cupons')
      .select('*')
      .eq('codigo', codigo.toUpperCase().trim())
      .eq('ativo', true)
      .single();

    if (!cupom) return res.status(400).json({ erro: 'Cupom inválido.' });
    if (cupom.validade && new Date(cupom.validade) < new Date()) {
      return res.status(400).json({ erro: 'Cupom vencido.' });
    }
    if (cupom.limite_uso && cupom.usos >= cupom.limite_uso) {
      return res.status(400).json({ erro: 'Cupom esgotado.' });
    }
    if (subtotal && subtotal < (cupom.valor_minimo || 0)) {
      return res.status(400).json({
        erro: `Valor mínimo: R$ ${cupom.valor_minimo?.toFixed(2)}`
      });
    }

    let desconto = 0;
    if (cupom.desconto_percent) {
      desconto = parseFloat(((subtotal * cupom.desconto_percent) / 100).toFixed(2));
    } else if (cupom.desconto_fixo) {
      desconto = Math.min(parseFloat(cupom.desconto_fixo), subtotal || 0);
    }

    return res.status(200).json({
      valido: true,
      desconto,
      desconto_percent: cupom.desconto_percent,
      desconto_fixo: cupom.desconto_fixo,
      codigo: cupom.codigo
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao validar cupom.' });
  }
}

async function criarCupom(req, res) {
  const { codigo, desconto_percent, desconto_fixo, valor_minimo, validade, limite_uso } = req.body;
  if (!codigo) return res.status(400).json({ erro: 'Código obrigatório.' });
  if (!desconto_percent && !desconto_fixo) {
    return res.status(400).json({ erro: 'Informe desconto_percent ou desconto_fixo.' });
  }

  try {
    const { data, error } = await supabase
      .from('cupons')
      .insert([{
        codigo: codigo.toUpperCase().trim(),
        desconto_percent: desconto_percent || null,
        desconto_fixo: desconto_fixo || null,
        valor_minimo: valor_minimo || 0,
        validade: validade || null,
        limite_uso: limite_uso || null
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ erro: 'Código já existe.' });
      throw error;
    }
    return res.status(201).json({ mensagem: 'Cupom criado!', cupom: data });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao criar cupom.' });
  }
}

async function listarCupons(req, res) {
  try {
    const { data, error } = await supabase
      .from('cupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar cupons.' });
  }
}

module.exports = {
  criarAvaliacao, listarAvaliacoesProduto,
  toggleFavorito, listarFavoritos,
  listarNotificacoes, marcarNotificacaoLida, marcarTodasLidas,
  validarCupom, criarCupom, listarCupons
};