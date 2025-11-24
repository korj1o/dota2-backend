// Подключаем библиотеку для работы с PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

// Конфигурация для Railway (DATABASE_URL) или локальной разработки
const getPoolConfig = () => {
  // Если есть DATABASE_URL от Railway - используем его
  if (process.env.DATABASE_URL) {
    console.log('🗄️ Используем DATABASE_URL от Railway');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // ВАЖНО для Railway!
      }
    };
  }
  
  // Иначе используем отдельные переменные (для локальной разработки)
  console.log('🗄️ Используем локальную базу данных');
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dota2_stats',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
  };
};

// Создаем "пул соединений"
const pool = new Pool(getPoolConfig());

// Проверяем подключение к базе
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе:', err.message);
    console.error('📍 Подробности:', {
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      hasDatabaseUrl: !!process.env.DATABASE_URL
    });
  } else {
    console.log('✅ Успешно подключились к PostgreSQL!');
    console.log('📍 Режим:', process.env.DATABASE_URL ? 'Railway' : 'Локальный');
    release(); // Освобождаем соединение
  }
});

// Обработка ошибок пула
pool.on('error', (err) => {
  console.error('❌ Неожиданная ошибка базы данных:', err);
});

// Экспортируем пул чтобы использовать в других файлах
module.exports = pool;