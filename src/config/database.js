// Подключаем библиотеку для работы с PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

// Конфигурация для Railway (DATABASE_URL) или локальной разработки
const getPoolConfig = () => {
  // Если есть DATABASE_URL от Railway - используем его
  if (process.env.DATABASE_URL) {
    console.log('🗄️ Используем DATABASE_URL от Railway');
    console.log('📍 Хост:', new URL(process.env.DATABASE_URL).hostname);
    
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // КРИТИЧЕСКИ ВАЖНО для Railway!
      },
      // Дополнительные настройки для лучшей производительности
      max: 20, // максимальное количество клиентов в пуле
      idleTimeoutMillis: 30000, // время простоя перед закрытием
      connectionTimeoutMillis: 10000, // таймаут подключения
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
    // Настройки для локальной разработки
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
};

// Создаем "пул соединений"
const pool = new Pool(getPoolConfig());

// Проверяем подключение к базе
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе:', err.message);
    console.error('🔧 Детали ошибки:', {
      code: err.code,
      detail: err.detail
    });
    
    // Показываем информацию о подключении (без пароля)
    if (process.env.DATABASE_URL) {
      const url = new URL(process.env.DATABASE_URL);
      console.log('📍 Пытались подключиться к:', {
        host: url.hostname,
        port: url.port,
        database: url.pathname.replace('/', ''),
        user: url.username
      });
    } else {
      console.log('📍 Пытались подключиться к:', {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME
      });
    }
  } else {
    console.log('✅ Успешно подключились к PostgreSQL!');
    console.log('📍 Режим:', process.env.DATABASE_URL ? 'Railway' : 'Локальный');
    
    // Проверяем версию PostgreSQL
    client.query('SELECT version()', (err, res) => {
      if (!err) {
        console.log('📊 Версия PostgreSQL:', res.rows[0].version.split(',')[0]);
      }
      release(); // Освобождаем соединение
    });
  }
});

// Обработка ошибок пула
pool.on('error', (err) => {
  console.error('❌ Неожиданная ошибка базы данных:', err);
  console.error('📍 Код ошибки:', err.code);
});

// Обработка события при создании нового клиента
pool.on('connect', (client) => {
  console.log('🔌 Новое подключение к базе установлено');
});

// Обработка события при удалении клиента
pool.on('remove', (client) => {
  console.log('🔌 Подключение к базе закрыто');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Получен SIGINT, закрываем пул соединений...');
  await pool.end();
  console.log('✅ Пул соединений закрыт');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Получен SIGTERM, закрываем пул соединений...');
  await pool.end();
  console.log('✅ Пул соединений закрыт');
  process.exit(0);
});

// Экспортируем пул чтобы использовать в других файлах
module.exports = pool;