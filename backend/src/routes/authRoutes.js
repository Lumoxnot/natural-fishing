const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');
const { limiterAuth } = require('../middlewares/rateLimitMiddleware');
const {
  login, register, perfil, listUsers,
  updateUserRole, criarPrimeiroAdmin
} = require('../controllers/authController');

router.post('/login', limiterAuth, login);
router.post('/register', limiterAuth, register);
router.get('/perfil', authMiddleware, perfil);
router.get('/users', authMiddleware, adminMiddleware, listUsers);
router.put('/users/:id/role', authMiddleware, adminMiddleware, updateUserRole);

// REMOVA APÓS CRIAR O PRIMEIRO ADMIN
router.post('/criar-primeiro-admin', criarPrimeiroAdmin);

module.exports = router;