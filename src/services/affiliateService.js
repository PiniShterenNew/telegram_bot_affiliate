const config = require('../config');
const fs = require('fs');
const path = require('path');

// נסה לטעון את settings.js
let settings = {};
try {
  const settingsPath = path.join(__dirname, '..', '..', 'settings.js');
  if (fs.existsSync(settingsPath)) {
    settings = require('../../settings.js');
  }
} catch (err) {
  console.log('❌ שגיאה בטעינת settings.js:', err.message);
}

/**
 * מייצר קישור אפיליאציה לאיביי
 * @param {string} itemUrl כתובת המוצר
 * @param {string} itemId מזהה המוצר
 * @returns {string} קישור אפיליאציה
 */
function generateAffiliateLink(itemUrl, itemId) {
  // לוג מפורט של הנתונים שהתקבלו
  console.log(`\n🔗 יוצר קישור אפיליאציה:`);
  console.log(`מזהה מוצר: ${itemId}`);
  console.log(`URL שהתקבל: ${itemUrl}`);

  // וודא שיש לנו מזהה מוצר תקין
  if (!itemId) {
    console.error('❌ לא התקבל מזהה מוצר (itemId).');
    // במקרה זה נחזיר את ה-URL המקורי
    return itemUrl || 'https://www.ebay.com';
  }

  // בניית URL תקין למוצר, במקרה שה-URL המקורי אינו תקין
  let validItemUrl = itemUrl;
  
  // בדוק אם ה-URL נראה תקין
  if (!validItemUrl || !validItemUrl.startsWith('http')) {
    validItemUrl = `https://www.ebay.com/itm/${itemId}`;
    console.log(`⚠️ URL לא תקין, נוצר URL מחושב: ${validItemUrl}`);
  }
  
  // קבל את מזהה הקמפיין מהקונפיגורציה או מההגדרות
  // נסה למצוא את מזהה הקמפיין ממקורות שונים
  let campaignId = config.EPN_CAMPAIGN_ID;
  
  // אם לא נמצא בקונפיג, בדוק בקובץ settings
  if (!campaignId && settings.epnCampaignId) {
    campaignId = settings.epnCampaignId;
  }
  
  // אם עדיין לא נמצא, השתמש בערך ברירת מחדל
  if (!campaignId) {
    campaignId = '5339105864';  // Changed to a different campaign ID
    console.log(`⚠️ לא נמצא מזהה קמפיין בקונפיגורציה, משתמש בערך ברירת מחדל: ${campaignId}`);
  } else {
    console.log(`ℹ️ משתמש במזהה קמפיין: ${campaignId}`);
  }

  try {
    // שימוש בפורמט הישיר של קישורי eBay - גישה חדשה ופשוטה יותר
    // https://www.ebay.com/itm/ITEM_ID?mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=CAMPAIGN_ID&toolid=10001
    
    // בדוק אם ה-URL כבר מכיל פרמטרים
    const separator = validItemUrl.includes('?') ? '&' : '?';
    
    // בנה את הקישור עם פרמטרים ספציפיים של אפיליאציה
    const affLink = `${validItemUrl}${separator}mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=${campaignId}&toolid=10001&customid=telegram_bot`;
    
    console.log(`✅ קישור אפיליאציה נוצר בהצלחה: ${affLink}`);
    
    // שמור לבדיקה ידנית
    const testLinksPath = path.join(__dirname, '..', '..', 'data', 'test_links.txt');
    try {
      let testLinksContent = '';
      if (fs.existsSync(testLinksPath)) {
        testLinksContent = fs.readFileSync(testLinksPath, 'utf-8');
      }
      
      // הוסף את הקישור לקובץ הבדיקה
      const timestamp = new Date().toISOString();
      const linkEntry = `[${timestamp}] ItemID: ${itemId}\nOriginal: ${validItemUrl}\nAffiliate: ${affLink}\n\n`;
      
      // וודא שתיקיית data קיימת
      const dataDir = path.join(__dirname, '..', '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // כתוב עד 50 קישורים אחרונים (למניעת קובץ גדול מדי)
      const entries = testLinksContent.split('\n\n').filter(entry => entry.trim());
      entries.unshift(linkEntry.trim());
      fs.writeFileSync(testLinksPath, entries.slice(0, 50).join('\n\n') + '\n\n');
    } catch (err) {
      // נתעלם משגיאות בשמירת קישורים לבדיקה
      console.log('⚠️ לא ניתן לשמור קישור לבדיקה ידנית:', err.message);
    }
    
    return affLink;
  } catch (error) {
    console.error('❌ שגיאה ביצירת קישור אפיליאציה:', error.message);
    return validItemUrl; // החזר את הקישור המקורי במקרה של שגיאה
  }
}

module.exports = { generateAffiliateLink };
