const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middlewares/authMiddleware'); // ✅ CORRIGIDO

const {
  listarProdutos,
  obterProduto,
  criarProduto,
  atualizarProduto,
  deletarProduto
} = require('../controllers/produtosController');

// Rotas públicas
router.get('/', listarProdutos);
router.get('/:id', obterProduto);
// Rotas protegidas (admin)
router.post('/', authMiddleware, criarProduto);
router.put('/:id', authMiddleware, atualizarProduto);
router.delete('/:id', authMiddleware, deletarProduto);

module.exports = router;