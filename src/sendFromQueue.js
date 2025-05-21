const fs = require('fs');
const path = require('path');
const { postDealToTelegram } = require('./services/telegramService');
const { markDealAsSent } = require('./services/databaseService');

/**
 * קורא את הגדרות התזמון
 * @returns {Object} הגדרות התזמון
 */
function getSettings() {
  try {
    const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      console.log('⚠️ קובץ הגדרות לא נמצא, משתמש בהגדרות ברירת מחדל');
      return { send_enabled: true, start_hour: 9, end_hour: 21 };
    }
    
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings;
  } catch (err) {
    console.error('❌ שגיאה בקריאת הגדרות:', err.message);
    return { send_enabled: true, start_hour: 9, end_hour: 21 };
  }
}

/**
 * בודק אם השעה הנוכחית בטווח השליחה המוגדר
 * @param {Object} settings הגדרות תזמון
 * @returns {boolean} האם השעה כרגע בטווח
 */
function isTimeInSendingRange(settings) {
  const currentHour = new Date().getHours();
  return currentHour >= settings.start_hour && currentHour <= settings.end_hour;
}

/**
 * שולח 3 פריטים מתור הדילים
 */
async function sendFromQueue() {
  console.log(`\n📤 מריץ שליחה מתוזמנת בשעה ${new Date().toLocaleTimeString('he-IL')}`);
  
  // בדוק הגדרות
  const settings = getSettings();
  
  // אם השליחה מושבתת, עצור
  if (!settings.send_enabled) {
    console.log('📴 שליחת הודעות מושבתת בהגדרות');
    return;
  }
  
  // בדוק אם השעה הנוכחית בטווח הרצוי
  if (!isTimeInSendingRange(settings)) {
    console.log(`⏰ השעה הנוכחית (${new Date().getHours()}:00) מחוץ לטווח השליחה המוגדר (${settings.start_hour}:00-${settings.end_hour}:00)`);
    return;
  }
  
  // קובץ הדילים
  const dealsPath = path.join(__dirname, '..', 'data', 'daily_deals.json');
  
  // אם הקובץ לא קיים, עצור
  if (!fs.existsSync(dealsPath)) {
    console.error('❌ קובץ דילים יומי לא נמצא');
    return;
  }
  
  try {
    // טען את הדילים
    const dealsData = fs.readFileSync(dealsPath, 'utf8');
    let deals = JSON.parse(dealsData);
    
    if (!deals || !Array.isArray(deals) || deals.length === 0) {
      console.log('ℹ️ אין דילים בתור השליחה');
      return;
    }
    
    console.log(`📋 נותרו ${deals.length} דילים בתור`);
    
    // קח 3 דילים ראשונים
    const dealsToSend = deals.slice(0, 3);
    console.log(`🔔 שולח ${dealsToSend.length} דילים בסבב זה`);
    
    // שלח את הדילים
    for (const [index, deal] of dealsToSend.entries()) {
      console.log(`\n📤 שולח דיל ${index + 1}/${dealsToSend.length}:`);
      
      if (!deal.enriched) {
        console.error('❌ אין מידע מועשר לדיל, דילוג');
        continue;
      }
      
      // יצירת הודעה מעוצבת בפורמט החדש
      const message = `${deal.enriched.title}
${deal.enriched.product_title}

${deal.enriched.price_details}
${deal.enriched.coupon || ''}
${deal.enriched.shipping}

${deal.enriched.highlights}
${deal.enriched.rating}

🛒 לרכישה באיביי

${Array.isArray(deal.enriched.hashtags) ? deal.enriched.hashtags.join(' ') : ''}

📲 לעוד דילים והנחות הצטרפו לערוץ:
https://t.me/BestDealsHour`;

      console.log('----------------------------');
      console.log(message);
      console.log('\nקישור:', deal.affiliateUrl);
      console.log('תמונה:', deal.galleryURL);
      console.log('----------------------------');
      
      try {
        await postDealToTelegram(message, deal.galleryURL, deal.affiliateUrl);
        await markDealAsSent(deal.itemId, deal.title);
        console.log(`✅ הודעה נשלחה בהצלחה!`);
        
        // המתן 5 שניות בין הודעות
        if (index < dealsToSend.length - 1) {
          console.log('⏳ ממתין 5 שניות לפני השליחה הבאה...');
          await new Promise(res => setTimeout(res, 5000));
        }
      } catch (err) {
        console.error(`❌ שגיאה בשליחת הודעה:`, err.message);
        if (err.response) {
          console.error('פרטי שגיאה:', JSON.stringify(err.response.body || err.response.data || {}, null, 2));
        }
      }
    }
    
    // עדכן את הקובץ - הסר את הדילים ששלחנו
    deals = deals.slice(dealsToSend.length);
    fs.writeFileSync(dealsPath, JSON.stringify(deals, null, 2), 'utf8');
    
    console.log(`\n✅ הסבב הסתיים. נשארו ${deals.length} דילים בתור.`);
  } catch (err) {
    console.error('❌ שגיאה בעיבוד או שליחת דילים:', err.message);
  }
}

// אם מופעל ישירות מהקונסול
if (require.main === module) {
  sendFromQueue().catch(console.error);
}

module.exports = { sendFromQueue }; 