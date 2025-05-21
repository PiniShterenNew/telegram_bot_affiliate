const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const { generateDailyDeals } = require('./generateDailyDeals');
const { sendFromQueue } = require('./sendFromQueue');

console.log('📅 מופעל תזמון אוטומטי חדש להרצת דילים');

// יצירת דילים יומיים ב-08:45 בבוקר
schedule.scheduleJob('45 8 * * *', async () => {
  console.log(`[${new Date().toISOString()}] 🔍 מריץ יצירת דילים יומיים אוטומטית`);
  try {
    await generateDailyDeals();
    console.log(`[${new Date().toISOString()}] ✅ יצירת הדילים היומיים הסתיימה בהצלחה`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ שגיאה ביצירת דילים יומיים:`, err.message);
  }
});

// הגדרת תזמון כל שעה מ-9:00 עד 21:00 (שולח 3 דילים בכל שעה)
const hourlyJob = schedule.scheduleJob('0 9-21 * * *', async () => {
  const currentHour = new Date().getHours();
  console.log(`[${new Date().toISOString()}] 📤 מריץ שליחת דילים אוטומטית (שעה ${currentHour}:00)`);
  try {
    await sendFromQueue();
    console.log(`[${new Date().toISOString()}] ✅ שליחת הדילים לשעה זו הסתיימה בהצלחה`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ שגיאה בשליחת דילים:`, err.message);
  }
});

// בדיקה אם קיימים דילים בתחילת ההפעלה
async function checkAndInitializeDeals() {
  console.log(`[${new Date().toISOString()}] 🔍 בודק אם קיימים דילים...`);
  
  const dealsPath = path.join(__dirname, '..', 'data', 'daily_deals.json');
  let needToGenerateDeals = false;
  
  // בדוק אם קובץ הדילים קיים
  if (!fs.existsSync(dealsPath)) {
    console.log(`[${new Date().toISOString()}] ℹ️ קובץ דילים לא קיים, יוצר חדש...`);
    needToGenerateDeals = true;
  } else {
    try {
      // בדוק אם יש דילים בקובץ הקיים
      const dealsData = fs.readFileSync(dealsPath, 'utf8');
      const deals = JSON.parse(dealsData);
      
      if (!deals || !Array.isArray(deals) || deals.length === 0) {
        console.log(`[${new Date().toISOString()}] ℹ️ קובץ דילים קיים אך ריק, יוצר דילים חדשים...`);
        needToGenerateDeals = true;
      } else {
        console.log(`[${new Date().toISOString()}] ✅ נמצאו ${deals.length} דילים קיימים, ממשיך עם התור הקיים`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ שגיאה בקריאת קובץ דילים:`, err.message);
      needToGenerateDeals = true;
    }
  }
  
  // אם אין דילים, צור חדשים בלי קשר לשעה
  if (needToGenerateDeals) {
    console.log(`[${new Date().toISOString()}] 🚀 מריץ יצירת דילים ראשונית`);
    try {
      await generateDailyDeals();
      console.log(`[${new Date().toISOString()}] ✅ יצירת דילים ראשונית הסתיימה בהצלחה`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ שגיאה ביצירת דילים ראשונית:`, err.message);
      return false;
    }
  }
  
  // שלח דילים אם השעה מתאימה
  const currentHour = new Date().getHours();
  if (currentHour >= 9 && currentHour <= 21) {
    console.log(`[${new Date().toISOString()}] 📤 מריץ שליחת דילים ראשונית (השעה כעת ${currentHour}:00)`);
    try {
      await sendFromQueue();
      console.log(`[${new Date().toISOString()}] ✅ שליחת דילים ראשונית הסתיימה בהצלחה`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ שגיאה בשליחת דילים ראשונית:`, err.message);
    }
  } else {
    console.log(`[${new Date().toISOString()}] ℹ️ השעה הנוכחית (${currentHour}:00) מחוץ לטווח השליחה, ממתין עד השעה 9:00`);
  }
  
  return true;
}

// הפעלה ראשונית - בדוק אם יש דילים ואם לא צור חדשים
checkAndInitializeDeals()
  .then(result => {
    if (result) {
      console.log(`[${new Date().toISOString()}] ✅ אתחול ראשוני הסתיים בהצלחה`);
    } else {
      console.error(`[${new Date().toISOString()}] ⚠️ אתחול ראשוני הסתיים עם שגיאות`);
    }
  })
  .catch(err => console.error(`[${new Date().toISOString()}] ❌ שגיאה באתחול ראשוני:`, err.message));

console.log('⏱️ התזמון החדש הופעל:');
console.log('🔍 יצירת 39 דילים יומיים: כל יום בשעה 08:45');
console.log('📤 שליחת 3 דילים: כל שעה מ-9:00 עד 21:00');
console.log('📝 לחץ Ctrl+C כדי לעצור את התזמון'); 