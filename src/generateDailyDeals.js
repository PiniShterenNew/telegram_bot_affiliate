const fs = require('fs');
const path = require('path');
const { ISRAELI_AUDIENCE_NICHES } = require('./services/strategyGenerator');
const { fetchDealsFromStrategy } = require('./services/dealFetcher');
const { filterAndSummarizeDeals } = require('./services/geminiService');
const { generateAffiliateLink } = require('./services/affiliateService');

/**
 * יוצר מבנה אסטרטגיה מנישה
 * @param {Object} niche אובייקט הנישה
 * @returns {Object} אובייקט אסטרטגיה לחיפוש
 */
function createStrategyFromNiche(niche) {
  return {
    strategy_id: `daily_${niche.name.replace(/\s+/g, '_')}`,
    keywords: niche.keywords,
    min_price_usd: 3,
    max_price_usd: 40,
    prefer_free_shipping: true,
    category_ids: []
  };
}

/**
 * פונקציה לערבוב אקראי של מערך (שיטת Fisher-Yates)
 * @param {Array} array מערך לערבוב
 * @returns {Array} המערך המעורבב
 */
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * פונקציית יצירת 39 דילים יומיים
 */
async function generateDailyDeals() {
  console.log('🔍 מתחיל יצירת דילים יומיים...');
  
  // בדוק אם קיים קובץ דילים ישן ומחק אותו לפני יצירת חדש
  const dataDir = path.join(__dirname, '..', 'data');
  const outputPath = path.join(dataDir, 'daily_deals.json');
  
  if (fs.existsSync(outputPath)) {
    console.log('🧹 מוצא קובץ דילים קודם - מנקה לפני יצירת דילים חדשים');
    try {
      fs.writeFileSync(outputPath, JSON.stringify([], null, 2), 'utf8');
      console.log('✅ קובץ דילים קודם נוקה בהצלחה');
    } catch (err) {
      console.error('❌ שגיאה בניקוי קובץ דילים קודם:', err.message);
    }
  }
  
  // 1. טען את הנישות
  if (!ISRAELI_AUDIENCE_NICHES || ISRAELI_AUDIENCE_NICHES.length === 0) {
    console.error('❌ לא נמצאו נישות בקובץ');
    return false;
  }
  
  console.log(`✅ טענתי ${ISRAELI_AUDIENCE_NICHES.length} נישות`);
  
  // 2. בחר 13 נישות אקראיות
  const selectedNiches = shuffleArray(ISRAELI_AUDIENCE_NICHES).slice(0, 13);
  console.log(`✅ בחרתי ${selectedNiches.length} נישות אקראיות`);
  
  // 3. שלוף מוצרים מכל נישה
  const allDeals = [];
  
  for (const [index, niche] of selectedNiches.entries()) {
    console.log(`\n🔍 נישה ${index + 1}/${selectedNiches.length}: ${niche.name}`);
    
    // יצירת אסטרטגיה מהנישה
    const strategy = createStrategyFromNiche(niche);
    
    // שליפת מוצרים
    console.log(`  מחפש מוצרים לפי מילות מפתח: ${strategy.keywords.join(', ')}`);
    let dealsForNiche = [];
    try {
      dealsForNiche = await fetchDealsFromStrategy(strategy);
    } catch (err) {
      console.error(`❌ שגיאה בשליפת מוצרים עבור נישה "${niche.name}": ${err.message}`);
      // המשך לנישה הבאה
      dealsForNiche = []; // ודא שזה מערך ריק במקרה של שגיאה
    }
    
    if (dealsForNiche && dealsForNiche.length > 0) {
      console.log(`  ✅ נמצאו ${dealsForNiche.length} מוצרים לנישה "${niche.name}"`);
      
      // סנן רק מוצרים עם משלוח סביר
      const filteredDeals = dealsForNiche.filter(deal => {
        // אם המידע על המשלוח לא קיים או שעלות המשלוח מעל $10, סנן החוצה
        if (!deal.shippingInfo || !deal.shippingInfo.shippingServiceCost) return true; // אם אין מידע, כנראה משלוח חינם
        
        const shippingCost = parseFloat(deal.shippingInfo.shippingServiceCost.value);
        return isNaN(shippingCost) || shippingCost <= 10;
      });
      
      console.log(`  🚚 לאחר סינון משלוח (מתחת ל-$10): ${filteredDeals.length} מוצרים`);
      
      // בחר עד 5 מוצרים אקראיים מתוך אלו שנמצאו
      const nicheDeals = shuffleArray(filteredDeals).slice(0, 5);
      
      // הוסף את הפרטים של הנישה לכל מוצר
      nicheDeals.forEach(deal => {
        allDeals.push({
          ...deal,
          nicheInfo: {
            name: niche.name,
            keywords: niche.keywords,
            why: niche.why
          }
        });
      });
    } else {
      console.log(`  ⚠️ לא נמצאו מוצרים לנישה "${niche.name}"`);
    }
  }
  
  // אם לא נמצאו מספיק מוצרים, נסה לחפש מהנישות הנותרות
  if (allDeals.length < 39) {
    console.log(`\n⚠️ נמצאו רק ${allDeals.length} מוצרים, ממשיך לחפש...`);
    
    // מצא נישות שלא השתמשנו בהן
    const remainingNiches = ISRAELI_AUDIENCE_NICHES.filter(
      niche => !selectedNiches.some(selected => selected.name === niche.name)
    );
    
    // בחר נישות נוספות
    const additionalNiches = shuffleArray(remainingNiches).slice(0, Math.min(5, remainingNiches.length));
    
    for (const [index, niche] of additionalNiches.entries()) {
      console.log(`\n🔍 נישה נוספת ${index + 1}/${additionalNiches.length}: ${niche.name}`);
      
      const strategy = createStrategyFromNiche(niche);
      let dealsForNiche = [];
      try {
        dealsForNiche = await fetchDealsFromStrategy(strategy);
      } catch (err) {
        console.error(`❌ שגיאה בשליפת מוצרים עבור נישה נוספת "${niche.name}": ${err.message}`);
        dealsForNiche = []; // ודא שזה מערך ריק במקרה של שגיאה
      }
      
      if (dealsForNiche && dealsForNiche.length > 0) {
        const filteredDeals = dealsForNiche.filter(deal => {
          if (!deal.shippingInfo || !deal.shippingInfo.shippingServiceCost) return true;
          const shippingCost = parseFloat(deal.shippingInfo.shippingServiceCost.value);
          return isNaN(shippingCost) || shippingCost <= 10;
        });
        
        const nicheDeals = shuffleArray(filteredDeals).slice(0, 5);
        
        nicheDeals.forEach(deal => {
          allDeals.push({
            ...deal,
            nicheInfo: {
              name: niche.name,
              keywords: niche.keywords,
              why: niche.why
            }
          });
        });
      }
      
      // אם יש לנו מספיק מוצרים, עצור
      if (allDeals.length >= 39) break;
    }
  }
  
  console.log(`\n✅ נאספו ${allDeals.length} מוצרים מכל הנישות`);
  
  // ערבב את כל המוצרים לגיוון
  const shuffledDeals = shuffleArray(allDeals);
  
  // הגבל ל-39 מוצרים
  const finalDeals = shuffledDeals.slice(0, 39);
  console.log(`\n✅ נבחרו ${finalDeals.length} מוצרים סופיים`);
  
  // 4. שלח ל-Gemini בקבוצות של 13 מוצרים
  console.log('\n🧠 שולח מוצרים לניתוח Gemini (בקבוצות של 13)...');
  
  const batchSize = 13;
  const enrichedDeals = [];
  
  for (let i = 0; i < finalDeals.length; i += batchSize) {
    const batch = finalDeals.slice(i, i + batchSize);
    console.log(`\n📊 מעבד קבוצה ${Math.floor(i/batchSize) + 1}/${Math.ceil(finalDeals.length/batchSize)} (${batch.length} מוצרים)`);
    
    try {
      const enrichedBatch = await filterAndSummarizeDeals(batch);
      
      if (enrichedBatch && enrichedBatch.length > 0) {
        console.log(`✅ התקבלו ${enrichedBatch.length} סיכומים מ-Gemini`);
        
        // הוסף את המידע המועשר לכל מוצר
        for (let j = 0; j < batch.length; j++) {
          if (enrichedBatch[j]) {
            enrichedDeals.push({
              itemId: batch[j].itemId,
              title: batch[j].title,
              price: batch[j].sellingStatus?.currentPrice?.value || '',
              currency: batch[j].sellingStatus?.currentPrice?.currencyId || 'USD',
              shipping: batch[j].shippingInfo?.shippingServiceCost?.value || '0.00',
              galleryURL: batch[j].galleryURL,
              viewItemURL: batch[j].viewItemURL,
              affiliateUrl: generateAffiliateLink(batch[j].viewItemURL, batch[j].itemId),
              sellerInfo: batch[j].sellerInfo,
              enriched: enrichedBatch[j]
            });
          }
        }
      } else {
        console.error('❌ לא התקבלו סיכומים מ-Gemini לקבוצה זו');
      }
    } catch (err) {
      console.error(`❌ שגיאה בניתוח קבוצת מוצרים:`, err.message);
    }
    
    // חכה 2 שניות בין הקבוצות כדי לא להעמיס יותר מדי על Gemini
    if (i + batchSize < finalDeals.length) {
      console.log('⏳ ממתין 2 שניות לפני המשלוח הבא...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n✅ סה"כ הועשרו ${enrichedDeals.length} מוצרים באמצעות Gemini`);
  
  // 5. שמור את כל הדילים לקובץ JSON
  if (enrichedDeals.length > 0) {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const outputPath = path.join(dataDir, 'daily_deals.json');
    const tempOutputPath = `${outputPath}.tmp`;

    try {
      fs.writeFileSync(tempOutputPath, JSON.stringify(enrichedDeals, null, 2), 'utf8');
      fs.renameSync(tempOutputPath, outputPath);
      console.log(`\n✅ נשמרו ${enrichedDeals.length} דילים לקובץ ${outputPath}`);
      if (enrichedDeals.length < 5) {
        console.warn(`⚠️ אזהרה: generateDailyDeals יצר רק ${enrichedDeals.length} דילים. יש לבדוק את שירותי המקור כמו dealFetcher או מצב eBay API.`);
      }
      return true;
    } catch (err) {
      console.error(`❌ שגיאה בשמירת קובץ הדילים: ${err.message}`);
      // נסה למחוק את הקובץ הזמני אם קיים במקרה של שגיאה
      if (fs.existsSync(tempOutputPath)) {
        try {
          fs.unlinkSync(tempOutputPath);
          console.log('🗑️ הקובץ הזמני נמחק');
        } catch (unlinkErr) {
          console.error(`❌ שגיאה במחיקת הקובץ הזמני ${tempOutputPath}: ${unlinkErr.message}`);
        }
      }
      return false;
    }
  } else {
    console.error('❌ לא נמצאו דילים להעשרה, לא נשמר קובץ.');
    console.warn('⚠️ אזהרה: generateDailyDeals לא יצר דילים כלל. יש לבדוק את שירותי המקור כמו dealFetcher, Gemini, או מצב eBay API.');
    // החזרת false מציינת שהתהליך לא הצליח לייצר דילים, אך לא בהכרח שיש שגיאה קריטית שצריכה לעצור את כל האפליקציה.
    // ההחלטה אם לדרוס קובץ ישן עם קובץ ריק היא מורכבת. כרגע, אם אין דילים, לא נשמר קובץ חדש (ולא דורסים קודם).
    // אם רוצים התנהגות אחרת (לדוגמה, לא לדרוס אם הקודם קיים ויש בו תוכן), צריך להוסיף לוגיקה נוספת כאן.
    return false;
  }
}

// אם מופעל ישירות מהקונסול
if (require.main === module) {
  generateDailyDeals().catch(console.error);
}

module.exports = { generateDailyDeals }; 