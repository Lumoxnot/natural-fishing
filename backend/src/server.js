require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { limiterGeral } = require('./middlewares/rateLimitMiddleware');

const authRoutes     = require('./routes/authRoutes');
const produtosRoutes = require('./routes/produtosRoutes');
const pedidosRoutes  = require('./routes/pedidosRoutes');
const extrasRoutes   = require('./routes/extrasRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(limiterGeral);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', versao: '2.0.0' });
});

app.use('/auth',     authRoutes);
app.use('/produtos', produtosRoutes);
app.use('/pedidos',  pedidosRoutes);
app.use('/extras',   extrasRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
  console.error('Erro global:', err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎣 Natural Fishing API v2.0 rodando na porta ${PORT}`);
});