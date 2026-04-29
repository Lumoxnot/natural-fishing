const rateLimit = require('express-rate-limit');

const limiterGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

const limiterPedidos = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { erro: 'Muitos pedidos em sequência. Aguarde um momento.' }
});

module.exports = { limiterGeral, limiterAuth, limiterPedidos };