const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');
const {
  criarAvaliacao, listarAvaliacoesProduto,
  toggleFavorito, listarFavoritos,
  listarNotificacoes, marcarNotificacaoLida, marcarTodasLidas,
  validarCupom, criarCupom, listarCupons
} = require('../controllers/extrasController');

// Avaliações
router.post('/avaliacoes', authMiddleware, criarAvaliacao);
router.get('/avaliacoes/:produto_id', listarAvaliacoesProduto);

// Favoritos
router.post('/favoritos', authMiddleware, toggleFavorito);
router.get('/favoritos', authMiddleware, listarFavoritos);

// Notificações
router.get('/notificacoes', authMiddleware, listarNotificacoes);
router.put('/notificacoes/:id/lida', authMiddleware, marcarNotificacaoLida);
router.put('/notificacoes/todas/lidas', authMiddleware, marcarTodasLidas);

// Cupons
router.post('/cupons/validar', authMiddleware, validarCupom);
router.post('/cupons', authMiddleware, adminMiddleware, criarCupom);
router.get('/cupons', authMiddleware, adminMiddleware, listarCupons);

module.exports = router;