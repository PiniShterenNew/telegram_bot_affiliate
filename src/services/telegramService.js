const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: false });

async function postDealToTelegram(dealText, imageUrl, affiliateLink) {
  console.log(`🤖 מתחיל שליחה לערוץ הטלגרם: ${config.TELEGRAM_CHANNEL_ID}`);
  
  // בדיקה שקישור האפיליאציה תקין
  if (!affiliateLink || !affiliateLink.startsWith('http')) {
    console.error('⚠️ קישור האפיליאציה אינו תקין:', affiliateLink);
    affiliateLink = 'https://www.ebay.com'; // ברירת מחדל אם אין קישור תקף
  }
  
  // יצירת מקלדת עם כפתור לרכישה
  const opts = {
    caption: dealText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 לרכישה מאובטחת', url: affiliateLink }]
      ]
    }
  };
  
  console.log('🖼️ תמונה:', imageUrl ? 'נמצאה' : 'חסרה');
  console.log(`📝 אורך הטקסט: ${dealText.length} תווים`);
  
  try {
    // ניסיון לשלוח הודעה עם תמונה
    const result = await bot.sendPhoto(
      config.TELEGRAM_CHANNEL_ID, 
      imageUrl || 'https://ir.ebaystatic.com/cr/v/c1/ebay-logo-1-1200x630-margin.png', 
      opts
    );
    
    console.log(`✅ הודעה נשלחה בהצלחה לערוץ ${config.TELEGRAM_CHANNEL_ID}`);
    console.log(`🆔 מזהה הודעה: ${result.message_id}`);
    return result;
  } catch (error) {
    console.error(`❌ שגיאה בשליחה לטלגרם:`, error.message);
    console.error('קוד שגיאה:', error.code);
    
    // ניסיון לשליחה בלי תמונה אם נכשל
    if (error.message.includes('image') || error.message.includes('photo')) {
      console.log('🔄 מנסה לשלוח הודעת טקסט בלבד...');
      try {
        const textResult = await bot.sendMessage(config.TELEGRAM_CHANNEL_ID, dealText, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛒 לרכישה מאובטחת', url: affiliateLink }]
            ]
          }
        });
        console.log(`✅ הודעת טקסט נשלחה בהצלחה לערוץ ${config.TELEGRAM_CHANNEL_ID}`);
        return textResult;
      } catch (secondError) {
        console.error('❌ גם שליחת טקסט נכשלה:', secondError.message);
        
        // לוג מפורט יותר לשגיאה השנייה
        if (secondError.response) {
          console.error('פרטי שגיאה:', JSON.stringify(secondError.response.body || {}, null, 2));
        }
      }
    }
    
    throw error;
  }
}

module.exports = { postDealToTelegram };
