const pool = require('../config/database');

// Функция для получения профиля игрока
// Функция для получения профиля игрока (ИСПРАВЛЕННАЯ)
const getPlayerProfile = async (req, res) => {
  try {
    console.log('📥 Получен запрос профиля:', req.body);
    
    // Получаем SteamID из body (для POST запросов из Lua)
    const { SteamID, steamId } = req.body;
    const steamIdToUse = SteamID || steamId;
    
    // Проверяем валидность SteamID
    if (!steamIdToUse || isNaN(steamIdToUse)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный SteamID: ' + steamIdToUse
      });
    }

    console.log('🔍 Поиск игрока с SteamID:', steamIdToUse);

    // Ищем игрока в базе
    const result = await pool.query(
      'SELECT * FROM players WHERE steam_id = $1',
      [steamIdToUse]
    );

    // Если игрок не найден
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Игрок не найден',
        steamId: steamIdToUse
      });
    }

    // Возвращаем профиль игрока
    const player = result.rows[0];
    
    console.log('✅ Найден игрок:', player.nickname);
    
    res.json({
      success: true,
      profile: {
        steamid: player.steam_id,
        nickname: player.nickname,
        total_matches: player.total_matches,
        wins: player.wins,
        losses: player.losses,
        rating: player.rating,
        win_rate: player.total_matches > 0 
          ? ((player.wins / player.total_matches) * 100).toFixed(1)
          : 0
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения профиля:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};

// Функция для создания нового игрока
const createPlayerProfile = async (req, res) => {
  try {
    const { steamId, nickname } = req.body;

    // Проверяем обязательные поля
    if (!steamId || !nickname) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы steamId и nickname'
      });
    }

    // Создаем нового игрока
    const result = await pool.query(
      `INSERT INTO players (steam_id, nickname) 
       VALUES ($1, $2) 
       RETURNING *`,
      [steamId, nickname]
    );

    const newPlayer = result.rows[0];
    
    res.status(201).json({
      success: true,
      message: 'Профиль создан',
      profile: {
        steamid: newPlayer.steam_id,
        nickname: newPlayer.nickname,
        total_matches: newPlayer.total_matches,
        wins: newPlayer.wins,
        losses: newPlayer.losses,
        rating: newPlayer.rating
      }
    });

  } catch (error) {
    // Если игрок уже существует
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Игрок уже существует'
      });
    }
    
    console.error('❌ Ошибка создания профиля:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};

// Функция для получения лидерборда
const getLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Получаем топ игроков по рейтингу
    const result = await pool.query(
      `SELECT 
        steam_id,
        nickname,
        rating,
        total_matches,
        wins,
        losses,
        CASE 
          WHEN total_matches > 0 THEN ROUND((wins::decimal / total_matches) * 100, 1)
          ELSE 0 
        END as win_rate
       FROM players 
       WHERE total_matches > 0
       ORDER BY rating DESC 
       LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      leaderboard: result.rows.map((player, index) => ({
        rank: index + 1,
        steamid: player.steam_id,
        nickname: player.nickname,
        rating: player.rating,
        total_matches: player.total_matches,
        wins: player.wins,
        losses: player.losses,
        win_rate: player.win_rate
      }))
    });

  } catch (error) {
    console.error('❌ Ошибка получения лидерборда:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};

// Функция для завершения матча
const finishGameForPlayer = async (req, res) => {
  try {
    console.log('📨 Получен запрос на завершение матча:', req.body);
    
    const { match_id, mode_id, difficult, player_info } = req.body;

    // Проверяем обязательные поля
    if (!match_id || !player_info || !player_info.SteamID) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы match_id и player_info со SteamID'
      });
    }

    const { SteamID, win, duration, kills_creeps, deaths, gold, level, heroname } = player_info;

    // Начинаем транзакцию (важно для согласованности данных)
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN'); // Начало транзакции

      // 1. Создаем или находим матч
      await client.query(
        `INSERT INTO matches (match_id, game_mode, difficulty, duration) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (match_id) DO NOTHING`,
        [match_id, mode_id || 0, difficult || 1, duration || 0]
      );

      // 2. Рассчитываем изменение рейтинга
      const ratingChange = win ? 30 : -30;

      // 3. Добавляем статистику игрока
      await client.query(
        `INSERT INTO player_matches 
         (steam_id, match_id, hero_name, kills_creeps, deaths, gold, level, win, rating_change) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [SteamID, match_id, heroname, kills_creeps || 0, deaths || 0, gold || 0, level || 1, win, ratingChange]
      );

      // 4. Обновляем общую статистику игрока
      await client.query(
        `UPDATE players 
         SET total_matches = total_matches + 1,
             wins = wins + $1,
             losses = losses + $2,
             rating = rating + $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE steam_id = $4`,
        [win ? 1 : 0, win ? 0 : 1, ratingChange, SteamID]
      );

      // 5. Получаем обновленного игрока
      const playerResult = await client.query(
        'SELECT * FROM players WHERE steam_id = $1',
        [SteamID]
      );

      await client.query('COMMIT'); // Подтверждаем транзакцию

      const updatedPlayer = playerResult.rows[0];

      res.json({
        success: true,
        message: win ? 'Победа! +30 рейтинга' : 'Поражение! -30 рейтинга',
        rating_change: ratingChange,
        new_rating: updatedPlayer.rating,
        profile: {
          steamid: updatedPlayer.steam_id,
          nickname: updatedPlayer.nickname,
          total_matches: updatedPlayer.total_matches,
          wins: updatedPlayer.wins,
          losses: updatedPlayer.losses,
          rating: updatedPlayer.rating
        }
      });

    } catch (error) {
      await client.query('ROLLBACK'); // Откатываем при ошибке
      throw error;
    } finally {
      client.release(); // Освобождаем соединение
    }

  } catch (error) {
    console.error('❌ Ошибка завершения матча:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};

// Упрощенная версия для теста
const finishGameSimple = async (req, res) => {
  try {
    console.log('📨 Получен упрощенный запрос на матч:', req.body);
    
    const { player_info } = req.body;
    const { SteamID, win } = player_info || {};

    if (!SteamID) {
      return res.status(400).json({
        success: false,
        error: 'Не указан SteamID'
      });
    }

    // Простой расчет рейтинга
    const ratingChange = win ? 30 : -30;

    // Обновляем рейтинг игрока
    const result = await pool.query(
      `UPDATE players 
       SET total_matches = total_matches + 1,
           wins = wins + $1,
           losses = losses + $2, 
           rating = rating + $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE steam_id = $4
       RETURNING *`,
      [win ? 1 : 0, win ? 0 : 1, ratingChange, SteamID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Игрок не найден'
      });
    }

    const updatedPlayer = result.rows[0];

    res.json({
      success: true,
      message: win ? 'Победа! +30 рейтинга' : 'Поражение! -30 рейтинга',
      rating_change: ratingChange,
      new_rating: updatedPlayer.rating,
      profile: {
        steamid: updatedPlayer.steam_id,
        nickname: updatedPlayer.nickname,
        total_matches: updatedPlayer.total_matches,
        wins: updatedPlayer.wins,
        losses: updatedPlayer.losses,
        rating: updatedPlayer.rating
      }
    });

  } catch (error) {
    console.error('❌ Ошибка в finishGameSimple:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера: ' + error.message
    });
  }
};

module.exports = {
  getPlayerProfile,
  createPlayerProfile,
  finishGameForPlayer,
  finishGameSimple,
  getLeaderboard  // ← ДОБАВЬТЕ ЭТУ СТРОКУ
};