const fs = require('fs');
const path = require('path');
const axios = require('axios');
const qs = require('querystring');
const config = require('../config');

const TOKEN_PATH = path.join(__dirname, '../../data/ebay_token.json');

function isTokenValid(tokenObj) {
  if (!tokenObj || !tokenObj.access_token || !tokenObj.expires_at) return false;
  const now = Date.now();
  return now < tokenObj.expires_at;
}

function readTokenFromFile() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  const data = fs.readFileSync(TOKEN_PATH, 'utf-8');
  return JSON.parse(data);
}

function saveTokenToFile(tokenObj) {
  // וודא שתיקיית data קיימת
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const tempTokenPath = `${TOKEN_PATH}.tmp`;
  try {
    fs.writeFileSync(tempTokenPath, JSON.stringify(tokenObj, null, 2), 'utf8');
    fs.renameSync(tempTokenPath, TOKEN_PATH);
  } catch (err) {
    console.error(`❌ שגיאה בשמירת קובץ הטוקן ${TOKEN_PATH}:`, err.message);
    // נסה למחוק את הקובץ הזמני אם קיים במקרה של שגיאה
    if (fs.existsSync(tempTokenPath)) {
      try {
        fs.unlinkSync(tempTokenPath);
        console.log('🗑️ הקובץ הזמני של הטוקן נמחק');
      } catch (unlinkErr) {
        console.error(`❌ שגיאה במחיקת הקובץ הזמני של הטוקן ${tempTokenPath}:`, unlinkErr.message);
      }
    }
    // זרוק את השגיאה הלאה כדי שהקוד הקורא יהיה מודע לכך שהשמירה נכשלה
    throw err;
  }
}

function verifyCredentials() {
  if (!config.EBAY_CLIENT_ID || !config.EBAY_CLIENT_SECRET) {
    console.error(`
❌ מפתחות API של eBay חסרים או לא הוגדרו בקובץ .env
אנא עקוב אחר ההוראות הבאות:

1. צור קובץ .env בתיקיה הראשית של הפרויקט
2. הוסף את השורות הבאות עם המפתחות האמיתיים שלך:

EBAY_CLIENT_ID=מפתח-הלקוח-שלך-מ-ebay
EBAY_CLIENT_SECRET=מפתח-הסודי-שלך-מ-ebay
EBAY_SCOPE=https://api.ebay.com/oauth/api_scope
EBAY_MARKETPLACE_ID=EBAY_US

אם אין לך מפתחות eBay API, עליך להירשם בפורטל המפתחים של eBay:
https://developer.ebay.com/
`);
    throw new Error('eBay API credentials missing');
  }
}

async function getEbayAccessToken() {
  try {
    // בדוק שיש לנו מפתחות API
    verifyCredentials();
    
    const cachedToken = readTokenFromFile();

    if (isTokenValid(cachedToken)) {
      return cachedToken.access_token;
    }

    // בקשת טוקן חדש
    const credentials = Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64');

    const headers = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const data = qs.stringify({ grant_type: 'client_credentials', scope: config.EBAY_SCOPE });

    try {
      const res = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', data, { headers });

      const token = res.data.access_token;
      const expires_in = res.data.expires_in; // ב־שניות
      const expires_at = Date.now() + (expires_in * 1000) - (5 * 60 * 1000); // נוריד 5 דקות לשוליים

      const tokenObj = {
        access_token: token,
        expires_at,
      };

      saveTokenToFile(tokenObj);
      console.log('🔐 נשמר טוקן חדש של eBay ל־ebay_token.json');

      return token;
    } catch (err) {
      console.error('❌ שגיאה בקבלת טוקן מ־eBay:', err.response?.data || err.message);
      
      // בדוק האם השגיאה היא אימות לקוח 
      if (err.response?.data?.error === 'invalid_client') {
        console.error(`
🚨 אימות לקוח eBay נכשל. סיבות אפשריות:
1. מפתחות ה-API שגויים
2. המפתחות לא הועתקו במדויק
3. אין לך הרשאות מתאימות בחשבון המפתח של eBay
        
אנא וודא שמפתחות ה-API בקובץ .env נכונים ומדויקים!
        `);
      }
      
      throw err;
    }
  } catch (err) {
    // שגיאות שנזרקו מ־verifyCredentials או מהבקשה לטוקן יתפסו כאן
    // וייזרקו הלאה באופן אוטומטי אלא אם נרצה לטפל בהן באופן מיוחד כאן.
    // כרגע, נאפשר להן להתפשט הלאה.
    console.error('❌ שגיאה קריטית בתהליך קבלת טוקן eBay:', err.message);
    // במקום להחזיר טוקן דמה, אנחנו נאפשר לשגיאה להתפשט
    // כדי שהקוד הקורא יוכל לטפל בכשלון קבלת הטוקן.
    throw err; // זרוק את השגיאה המקורית הלאה
  }
}

module.exports = { getEbayAccessToken };
