// Vercel Serverless Function для выдачи ежедневного промокода
// Промокоды защищены на сервере, клиент получает только один код в день
// БЕЗ базы данных - вычисляется по дате

import promoCodes from './promo_codes.json';

// Стартовая дата: 4 мая 2026 = промокод #0
const START_DATE = new Date('2026-05-04T00:00:00+03:00'); // Московское время

export default function handler(req, res) {
  // CORS headers для доступа с фронтенда
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Получаем московское время (UTC+3)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const moscowTime = new Date(utc + (3600000 * 3));
    
    // Получаем дату в московском времени
    const moscowDateString = moscowTime.toDateString();
    
    // Вычисляем количество дней с START_DATE
    const moscowMidnight = new Date(moscowTime);
    moscowMidnight.setHours(0, 0, 0, 0);
    
    const startMidnight = new Date(START_DATE);
    startMidnight.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((moscowMidnight - startMidnight) / (1000 * 60 * 60 * 24));
    
    // Вычисляем индекс промокода (циклически)
    const promoIndex = daysDiff >= 0 ? daysDiff % promoCodes.length : 0;
    
    // Получаем промокод дня
    const dailyPromo = promoCodes[promoIndex];
    
    // Вычисляем время до следующего промокода
    const tomorrow = new Date(moscowTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilNext = tomorrow - moscowTime;
    
    // Возвращаем только один промокод
    return res.status(200).json({
      success: true,
      promo: dailyPromo,
      promoIndex: promoIndex,
      moscowDate: moscowDateString,
      timeUntilNext: timeUntilNext,
      totalPromos: promoCodes.length,
      daysSinceStart: daysDiff
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message
    });
  }
}
