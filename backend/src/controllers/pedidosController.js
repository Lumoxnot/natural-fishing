const supabase = require('../config/supabase');

async function criarPedido(req, res) {
  const usuarioId = req.user.id;
  const { itens, cupon_codigo, cep_entrega } = req.body;

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Itens do pedido são obrigatórios.' });
  }
  if (!cep_entrega) {
    return res.status(400).json({ erro: 'CEP de entrega é obrigatório.' });
  }

  try {
    // Busca dados do usuário para endereço
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('endereco, cep, numero_casa, cidade, estado')
      .eq('id', usuarioId)
      .single();

    // Valida cada produto e recalcula preços NO BACKEND
    let subtotal = 0;
    const itensValidados = [];

    for (const item of itens) {
      if (!item.produto_id || !item.quantidade || item.quantidade < 1) {
        return res.status(400).json({ erro: 'Item inválido no pedido.' });
      }

      const qtd = Math.floor(item.quantidade);
      if (qtd > 99) {
        return res.status(400).json({ erro: 'Quantidade máxima por item é 99.' });
      }

      // Busca produto real no banco — nunca confia no preço do frontend
      const { data: produto, error } = await supabase
        .from('produtos')
        .select('id, nome, preco, estoque, ativo')
        .eq('id', item.produto_id)
        .eq('ativo', true)
        .single();

      if (error || !produto) {
        return res.status(400).json({ erro: `Produto não encontrado: ${item.produto_id}` });
      }
      if (produto.estoque < qtd) {
        return res.status(400).json({
          erro: `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}`
        });
      }

      const precoReal = produto.preco; // Preço sempre vem do banco
      itensValidados.push({
        produto_id: produto.id,
        nome_produto: produto.nome,
        preco_unitario: precoReal,
        quantidade: qtd,
        subtotal: parseFloat((precoReal * qtd).toFixed(2))
      });

      subtotal += precoReal * qtd;
    }

    subtotal = parseFloat(subtotal.toFixed(2));

    // Valida e aplica cupom
    let desconto = 0;
    let cuponId = null;
    let cuponCodigoValido = null;

    if (cupon_codigo) {
      const { data: cupom } = await supabase
        .from('cupons')
        .select('*')
        .eq('codigo', cupon_codigo.toUpperCase().trim())
        .eq('ativo', true)
        .single();

      if (!cupom) {
        return res.status(400).json({ erro: 'Cupom inválido ou expirado.' });
      }
      if (cupom.validade && new Date(cupom.validade) < new Date()) {
        return res.status(400).json({ erro: 'Cupom vencido.' });
      }
      if (cupom.limite_uso && cupom.usos >= cupom.limite_uso) {
        return res.status(400).json({ erro: 'Cupom esgotado.' });
      }
      if (subtotal < (cupom.valor_minimo || 0)) {
        return res.status(400).json({
          erro: `Valor mínimo para este cupom: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cupom.valor_minimo)}`
        });
      }

      if (cupom.desconto_percent) {
        desconto = parseFloat(((subtotal * cupom.desconto_percent) / 100).toFixed(2));
      } else if (cupom.desconto_fixo) {
        desconto = Math.min(parseFloat(cupom.desconto_fixo), subtotal);
      }

      cuponId = cupom.id;
      cuponCodigoValido = cupom.codigo;
    }

    // Calcula frete por CEP
    const frete = calcularFrete(cep_entrega);

    // Total final calculado NO BACKEND
    const total = parseFloat((subtotal - desconto + frete).toFixed(2));

    // Cria pedido
    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .insert([{
        usuario_id: usuarioId,
        status: 'pendente',
        subtotal,
        desconto,
        frete,
        total,
        cupon_id: cuponId,
        cupon_codigo: cuponCodigoValido,
        endereco_entrega: `${usuario.endereco}, ${usuario.numero_casa}`,
        cep_entrega: cep_entrega.replace(/\D/g, ''),
        cidade_entrega: usuario.cidade,
        estado_entrega: usuario.estado
      }])
      .select()
      .single();

    if (errPedido) throw errPedido;

    // Insere itens
    const itensFinal = itensValidados.map(i => ({
      ...i,
      pedido_id: pedido.id
    }));

    const { error: errItens } = await supabase
      .from('pedido_itens')
      .insert(itensFinal);

    if (errItens) throw errItens;

    // Decrementa estoque e incrementa vendas
    for (const item of itensValidados) {
      await supabase.rpc('decrementar_estoque', {
        p_produto_id: item.produto_id,
        p_quantidade: item.quantidade
      });
    }

    // Incrementa uso do cupom
    if (cuponId) {
      await supabase
        .from('cupons')
        .update({ usos: supabase.rpc('increment', { x: 1 }) })
        .eq('id', cuponId);
    }

    // Simula pagamento (integrar com gateway real aqui)
    const pagamentoOk = await processarPagamento(pedido.id, total);

    if (pagamentoOk) {
      await supabase
        .from('pedidos')
        .update({ status: 'pago', pagamento_status: 'aprovado' })
        .eq('id', pedido.id);

      // Notifica usuário
      await supabase.from('notificacoes').insert([{
        usuario_id: usuarioId,
        titulo: '✅ Pedido confirmado!',
        mensagem: `Seu pedido #${pedido.id.slice(0, 8).toUpperCase()} foi pago e está em processamento.`,
        tipo: 'sucesso'
      }]);

      return res.status(201).json({
        mensagem: 'Pedido criado e pago com sucesso!',
        pedido: { ...pedido, status: 'pago' },
        total,
        frete,
        desconto
      });
    } else {
      return res.status(201).json({
        mensagem: 'Pedido criado. Aguardando confirmação de pagamento.',
        pedido,
        total,
        frete,
        desconto
      });
    }

  } catch (err) {
    console.error('Erro ao criar pedido:', err);
    return res.status(500).json({ erro: 'Erro ao processar pedido.' });
  }
}

function calcularFrete(cep) {
  if (!cep) return 15.00;
  const cepNum = parseInt(cep.replace(/\D/g, '').substring(0, 5));
  // Caraguatatuba e região (12230-000 a 12260-000)
  if (cepNum >= 12230 && cepNum <= 12260) return 0;
  // São Sebastião / Ubatuba
  if (cepNum >= 11680 && cepNum <= 11740) return 8.00;
  // São Paulo capital e ABCD
  if (cepNum >= 1000 && cepNum <= 9999) return 20.00;
  return 25.00;
}

async function processarPagamento(pedidoId, valor) {
  // Integre aqui com Stripe, MercadoPago, PagSeguro, etc.
  // Por ora, simula aprovação automática
  console.log(`💳 Processando pagamento do pedido ${pedidoId}: R$ ${valor}`);
  return true;
}

async function listarPedidosUsuario(req, res) {
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, status, subtotal, desconto, frete, total,
        cupon_codigo, created_at, updated_at,
        pedido_itens(
          id, nome_produto, preco_unitario, quantidade, subtotal
        )
      `)
      .eq('usuario_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
}

async function obterPedido(req, res) {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        pedido_itens(*),
        usuarios(nome, email)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    // Usuário só pode ver seus próprios pedidos; admin vê todos
    if (req.user.role !== 'admin' && data.usuario_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

async function listarTodosPedidos(req, res) {
  try {
    const { status } = req.query;
    let query = supabase
      .from('pedidos')
      .select(`
        id, status, total, created_at, updated_at,
        usuarios(nome, email),
        pedido_itens(quantidade)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
}

async function atualizarStatusPedido(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const statusValidos = ['pendente','pago','em_preparo','enviado','entregue','cancelado'];
  if (!status || !statusValidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }

  try {
    const { data, error } = await supabase
      .from('pedidos')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, usuarios(id, nome, email)')
      .single();

    if (error || !data) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    // Notifica usuário
    const mensagens = {
      em_preparo: '📦 Seu pedido está sendo preparado!',
      enviado: '🚚 Seu pedido foi enviado! Está a caminho.',
      entregue: '✅ Seu pedido foi entregue!',
      cancelado: '❌ Seu pedido foi cancelado.'
    };

    if (mensagens[status]) {
      await supabase.from('notificacoes').insert([{
        usuario_id: data.usuarios.id,
        titulo: 'Atualização do seu pedido',
        mensagem: mensagens[status],
        tipo: status === 'cancelado' ? 'erro' : 'sucesso'
      }]);
    }

    await supabase.from('admin_logs').insert([{
      admin_id: req.user.id,
      acao: 'ATUALIZAR_STATUS_PEDIDO',
      entidade: 'pedidos',
      entidade_id: id,
      detalhes: { status },
      ip: req.ip
    }]);

    return res.status(200).json({ mensagem: 'Status atualizado.', pedido: data });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao atualizar status.' });
  }
}

async function estatisticasAdmin(req, res) {
  try {
    const [
      { count: totalProdutos },
      { count: totalUsuarios },
      { data: vendasData },
      { data: maisVendidos }
    ] = await Promise.all([
      supabase.from('produtos').select('*', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('pedidos').select('total').eq('status', 'pago'),
      supabase.from('produtos')
        .select('id, nome, vendas, preco, imagem_url')
        .eq('ativo', true)
        .order('vendas', { ascending: false })
        .limit(5)
    ]);

    const totalVendas = vendasData?.reduce((acc, p) => acc + p.total, 0) || 0;

    return res.status(200).json({
      total_produtos: totalProdutos || 0,
      total_usuarios: totalUsuarios || 0,
      total_vendas: parseFloat(totalVendas.toFixed(2)),
      mais_vendidos: maisVendidos || []
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao buscar estatísticas.' });
  }
}

module.exports = {
  criarPedido,
  listarPedidosUsuario,
  obterPedido,
  listarTodosPedidos,
  atualizarStatusPedido,
  estatisticasAdmin
};