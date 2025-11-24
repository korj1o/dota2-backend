const express = require('express');
const router = express.Router();
const { 
  getPlayerProfile, 
  createPlayerProfile, 
  finishGameForPlayer,
  finishGameSimple,
  getLeaderboard
} = require('../controllers/playerController');

// Middleware для проверки игрового ключа
const validateGameKey = (req, res, next) => {
  let gameKey = req.body?.GameKey || req.query?.GameKey;
  
  console.log('🔑 Проверка ключа:', gameKey, 'Ожидается:', process.env.GAME_KEY);
  
  if (!gameKey || gameKey !== process.env.GAME_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Неверный игровой ключ'
    });
  }
  
  next();
};

// GET /api/player/:steamId - Получить профиль игрока (для браузера)
router.get('/player/:steamId', (req, res) => {
  // Для браузера не проверяем ключ
  const steamId = req.params.steamId;
  
  // Создаем фиктивный req объект для контроллера
  const mockReq = {
    body: { SteamID: steamId }
  };
  
  const mockRes = {
    json: (data) => res.json(data),
    status: (code) => ({ json: (data) => res.status(code).json(data) })
  };
  
  getPlayerProfile(mockReq, mockRes);
});

// POST /api/get_player_profile - Получить профиль игрока (для Lua)
router.post('/get_player_profile', validateGameKey, getPlayerProfile);

// POST /api/player - Создать профиль игрока
router.post('/player', validateGameKey, createPlayerProfile);

// POST /api/match/finish - Завершить матч (полная версия)
router.post('/match/finish', validateGameKey, finishGameForPlayer);

// POST /api/match/finish-simple - Упрощенное завершение матча
router.post('/match/finish-simple', validateGameKey, finishGameSimple);

// GET /api/leaderboard - Получить лидерборд
router.get('/leaderboard', (req, res) => {
  // Для браузера не проверяем ключ
  getLeaderboard(req, res);
});

// Простой endpoint для проверки работы
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '🚀 Сервер работает!', 
    timestamp: new Date().toISOString()
  });
});

// Обработка несуществующих API routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route не найден',
    requestedUrl: req.originalUrl,
    method: req.method
  });
});

module.exports = router;