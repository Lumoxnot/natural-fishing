const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

function calcularIdade(dataNascimento) {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function validarCPFEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function register(req, res) {
  const {
    nome, email, senha, telefone,
    endereco, cep, numero_casa,
    cidade, estado, data_nascimento
  } = req.body;

  if (!nome || !email || !senha || !telefone ||
      !endereco || !cep || !numero_casa ||
      !cidade || !estado || !data_nascimento) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }

  if (!validarCPFEmail(email)) {
    return res.status(400).json({ erro: 'E-mail inválido.' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter no mínimo 6 caracteres.' });
  }

  const idade = calcularIdade(data_nascimento);
  if (idade < 18) {
    return res.status(400).json({ erro: 'Você precisa ter 18 anos ou mais para se cadastrar.' });
  }

  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) {
    return res.status(400).json({ erro: 'CEP inválido.' });
  }

  try {
    const hash = await bcrypt.hash(senha, 12);

    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        senha: hash,
        telefone: telefone.trim(),
        endereco: endereco.trim(),
        cep: cepLimpo,
        numero_casa: numero_casa.trim(),
        cidade: cidade.trim(),
        estado: estado.trim(),
        data_nascimento,
        role: 'user'
      }])
      .select('id, email, nome, role')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
      }
      throw error;
    }

    return res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso!',
      user: data
    });

  } catch (err) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
}

async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('ativo', true)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, role: usuario.role, nome: usuario.nome },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      mensagem: 'Login realizado com sucesso.',
      token,
      user: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role
      }
    });

  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
}

async function perfil(req, res) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, endereco, cep, numero_casa, cidade, estado, data_nascimento, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

async function listUsers(req, res) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, role, ativo, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
}

async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['admin', 'user'].includes(role)) {
    return res.status(400).json({ erro: 'Papel inválido.' });
  }

  if (req.user.id === id && role !== 'admin') {
    return res.status(403).json({ erro: 'Você não pode rebaixar seu próprio papel.' });
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ role })
      .eq('id', id)
      .select('id, email, role')
      .single();

    if (error || !data) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    await registrarLogAdmin(req.user.id, 'ATUALIZAR_ROLE', 'usuarios', id, { role }, req.ip);
    return res.status(200).json({ mensagem: 'Papel atualizado.', user: data });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

async function criarPrimeiroAdmin(req, res) {
  const { email, senha, nome } = req.body;
  if (!email || !senha || !nome) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha obrigatórios.' });
  }
  try {
    const hash = await bcrypt.hash(senha, 12);
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        nome,
        email,
        senha: hash,
        telefone: '(00) 00000-0000',
        endereco: 'Admin',
        cep: '00000000',
        numero_casa: '0',
        cidade: 'Caraguatatuba',
        estado: 'SP',
        data_nascimento: '1990-01-01',
        role: 'admin'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ erro: 'E-mail já cadastrado.' });
      throw error;
    }
    return res.status(201).json({ mensagem: 'Admin criado.', id: data.id });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
}

async function registrarLogAdmin(adminId, acao, entidade, entidadeId, detalhes, ip) {
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

module.exports = { login, register, perfil, listUsers, updateUserRole, criarPrimeiroAdmin };