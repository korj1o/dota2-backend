// Подключаем необходимые библиотеки
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Подключаем наши роуты
const apiRoutes = require('./routes/api');

// Создаем Express приложение
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для безопасности
app.use(helmet());

// Middleware для CORS (улучшенная версия для продакшена)
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, из Dota 2) и с любых доменов
    if (!origin || origin === 'null') {
      return callback(null, true);
    }
    // Можно добавить конкретные домены если нужно
    return callback(null, true);
  },
  credentials: true
}));

// Middleware для парсинга JSON
app.use(express.json({ limit: '10mb' }));

// Health check корневого URL
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Dota 2 Stats API Server',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/player/:steamId',
      '/api/leaderboard'
    ]
  });
});

// Основной route
app.use('/api', apiRoutes);

// Обработка 404 ошибок (раскомментируйте и улучшите)
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route не найден',
    requestedUrl: req.originalUrl,
    method: req.method
  });
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('❌ Необработанная ошибка:', error);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : error.message
  });
});

// Запускаем сервер
app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log('🚀 Dota 2 Stats Server запущен!');
  console.log(`📍 Порт: ${PORT}`);
  console.log(`🌐 Режим: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ База: ${process.env.DATABASE_URL ? 'Railway' : 'Локальная'}`);
  console.log('=================================');
});