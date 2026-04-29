const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');
const { limiterPedidos } = require('../middlewares/rateLimitMiddleware');
const {
  criarPedido, listarPedidosUsuario, obterPedido,
  listarTodosPedidos, atualizarStatusPedido, estatisticasAdmin
} = require('../controllers/pedidosController');

router.post('/', authMiddleware, limiterPedidos, criarPedido);
router.get('/meus', authMiddleware, listarPedidosUsuario);
router.get('/admin/todos', authMiddleware, adminMiddleware, listarTodosPedidos);
router.get('/admin/stats', authMiddleware, adminMiddleware, estatisticasAdmin);
router.get('/:id', authMiddleware, obterPedido);
router.put('/:id/status', authMiddleware, adminMiddleware, atualizarStatusPedido);

module.exports = router;