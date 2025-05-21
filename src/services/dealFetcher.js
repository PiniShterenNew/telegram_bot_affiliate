const axios = require('axios');
const { getEbayAccessToken } = require('../auth/ebayAuth');

/**
 * מחפש מוצרים מ-eBay המתאימים לאסטרטגיה עם דגש על מוצרים מתאימים לקהל ישראלי
 * @param {Object} strategy אסטרטגיית החיפוש
 * @returns {Array} רשימת המוצרים שנמצאו 
 */
async function fetchDealsFromStrategy(strategy) {
  console.log(`🔍 מחפש פריטים לפי אסטרטגיה: ${strategy.strategy_id}`);
  console.log(`מילות מפתח: ${strategy.keywords.join(', ')}`);
  
  try {
    const accessToken = await getEbayAccessToken(); // This will now throw an error if token acquisition fails
    
    const endpoint = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
    
    // Try different search approaches if needed
    const searches = [
      // Attempt 1: Use all keywords
      { q: strategy.keywords.join(' ') },
      
      // Attempt 2: Use first two keywords only (if there are at least 2)
      strategy.keywords.length >= 2 ? { q: strategy.keywords.slice(0, 2).join(' ') } : null,
      
      // Attempt 3: Use just the first keyword
      strategy.keywords.length >= 1 ? { q: strategy.keywords[0] } : null
    ].filter(Boolean); // Remove null entries
    
    let items = [];
    
    // Try each search approach until we find items
    for (const searchParams of searches) {
      if (items.length > 0) break; // Stop if we already found items
      
      // בניית הפרמטרים לחיפוש
      const params = {
        ...searchParams,
        limit: 50, // מספר הפריטים שיוחזרו - increased for better diversity
        filter: []
      };
      
      // הוסף מחיר מקסימלי אם מוגדר
      if (strategy.max_price_usd) {
        params.filter.push(`price:[..${strategy.max_price_usd}]`);
      }
      
      // הוסף מחיר מינימלי אם מוגדר
      if (strategy.min_price_usd) {
        params.filter.push(`price:[${strategy.min_price_usd}..]`);
      }
      
      // הוסף קטגוריה אם מוגדרת
      if (strategy.category_ids?.length > 0) {
        // eBay מגביל לקטגוריה אחת בלבד בחיפוש
        params.category_ids = strategy.category_ids[0];
      }
      
      // הוסף העדפת משלוח חינם אם מוגדר (but make it optional if we're in later attempts)
      if (strategy.prefer_free_shipping && searchParams === searches[0]) {
        params.filter.push('freeShipping:true');
      }
      
      // סדר לפי התאמה מיטבית
      params.sort = 'bestMatch';
      
      // אנחנו מעוניינים במוצרים חדשים או באריזה פתוחה
      params.filter.push('conditions:{NEW|OPEN_BOX}');
      
      // הפוך את מערך הפילטרים למחרוזת
      if (params.filter.length > 0) {
        params.filter = params.filter.join(',');
      } else {
        delete params.filter;
      }

      try {
        console.log(`ניסיון חיפוש עם מילות מפתח: ${params.q}`);
        
        // בצע את הבקשה עם ה-headers המתאימים להצגת מחירים בשקלים לישראל
        const { data } = await axios.get(endpoint, { 
          params,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=IL,currency=ILS'
          }
        });

        const foundItems = data.itemSummaries || [];
        
        if (foundItems.length > 0) {
          console.log(`✅ נמצאו ${foundItems.length} פריטים מתאימים עם המילים: ${params.q}\n`);
          items = foundItems;
          break; // Exit the loop as we found items
        } else {
          console.log(`⚠️ לא נמצאו פריטים עם המילים: ${params.q}`);
        }
      } catch (err) {
        console.error(`❌ שגיאה בחיפוש '${params.q}':`, err.message);
        if (err.response?.data) {
          console.error('פרטי שגיאה:', JSON.stringify(err.response.data, null, 2));
        }
        // Continue to next search attempt
      }
    }
    
    if (items.length === 0) {
      console.log('❌ לא נמצאו מוצרים מתאימים בכל ניסיונות החיפוש');
      // במקום להחזיר נתוני דמה, נחזיר מערך ריק
      return [];
    }
    
    // This check is redundant now as the above block handles items.length === 0
    // However, keeping the log for when items ARE found is fine.
    if (items.length > 0) {
      console.log('דוגמאות פריטים:');
      for (let i = 0; i < Math.min(2, items.length); i++) {
        console.log(`${i+1}. ${items[i].title} - ${items[i].price.value} ${items[i].price.currency}`);
        console.log(`   ${items[i].itemWebUrl}\n`);
      }
    }
    
    // הוספת סינון למוצרים עם עלות משלוח גבוהה
    const MAX_SHIPPING_COST_RATIO = 0.03; // הורדת הרף ל-3% ממחיר המוצר (היה 5%)
    const MAX_ABSOLUTE_SHIPPING_COST = 8; // מקסימום עלות משלוח מוחלטת ב-$
    const itemsWithReasonableShipping = [];
    
    for (const item of items) {
      const itemPrice = parseFloat(item.price?.value || 0);
      const shippingCost = parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || 0);
      
      // לוג פרטי המשלוח למטרות בדיקה
      console.log(`מוצר: ${item.title?.substring(0, 30)}... | מחיר: ${itemPrice} | עלות משלוח: ${shippingCost}`);
      
      // תנאים משופרים למשלוח:
      // 1. משלוח חינם
      // 2. או עלות משלוח נמוכה מאוד ביחס למחיר המוצר (3% במקום 5% קודם)
      // 3. או עלות משלוח מוחלטת של פחות מ-8$
      if (shippingCost === 0 || 
          (itemPrice > 0 && shippingCost <= itemPrice * MAX_SHIPPING_COST_RATIO) ||
          shippingCost <= MAX_ABSOLUTE_SHIPPING_COST) {
        itemsWithReasonableShipping.push(item);
      }
      // נשמור מספר מועט של מוצרים גם אם המשלוח יקר, רק במקרה שיש מעט תוצאות
      else if (items.length <= 10 || itemsWithReasonableShipping.length < 3) {
        console.log(`⚠️ כולל מוצר עם משלוח יקר יחסית (${shippingCost}$) רק בגלל מיעוט תוצאות`);
        itemsWithReasonableShipping.push(item);
      }
    }
    
    const filteredItemCount = items.length - itemsWithReasonableShipping.length;
    if (filteredItemCount > 0) {
      console.log(`⚠️ סוננו ${filteredItemCount} מוצרים עם עלות משלוח גבוהה מדי (מעל ${MAX_SHIPPING_COST_RATIO * 100}% ממחיר המוצר או מעל ${MAX_ABSOLUTE_SHIPPING_COST}$)`);
    }
    
    // Ensure diverse selection by shuffling and picking from different categories
    const shuffledItems = itemsWithReasonableShipping.sort(() => 0.5 - Math.random());
    const diverseSelection = [];
    const categorySet = new Set();
    
    // First pass: try to get diverse categories
    for (const item of shuffledItems) {
      if (diverseSelection.length >= 5) break;
      if (!categorySet.has(item.categoryId)) {
        diverseSelection.push(item);
        categorySet.add(item.categoryId);
      }
    }
    
    // Second pass: fill remaining slots if needed
    if (diverseSelection.length < 5) {
      for (const item of shuffledItems) {
        if (diverseSelection.length >= 5) break;
        if (!diverseSelection.some(selected => selected.itemId === item.itemId)) {
          diverseSelection.push(item);
        }
      }
    }
    
    return diverseSelection.map(item => {
      // וודא שה-URL של המוצר הוא תקין
      let itemWebUrl = item.itemWebUrl || '';
      const itemId = item.itemId || '';
      
      if (!itemWebUrl.startsWith('http') || itemWebUrl.includes('rover.ebay') || itemWebUrl.includes('pulsar.ebay')) {
        // אם ה-URL לא תקין או אם זה כבר קישור אפיליאציה, בנה URL ישיר חדש
        itemWebUrl = `https://www.ebay.com/itm/${itemId}`;
        console.log(`⚠️ בניית URL מחדש למוצר ${itemId}: ${itemWebUrl}`);
      }
      
      // וודא שיש לנו URL תקין של תמונה
      let imageUrl = null;
      if (item.thumbnailImages && item.thumbnailImages.length > 0 && item.thumbnailImages[0].imageUrl) {
        imageUrl = item.thumbnailImages[0].imageUrl;
      } else if (item.image && item.image.imageUrl) {
        imageUrl = item.image.imageUrl;
      }
      
      // אם אין תמונה תקינה, נשתמש ב-URL שתחרוג בהתאם ל-itemId
      if (!imageUrl || !imageUrl.startsWith('http')) {
        // נסה להשתמש בשירות תמונות של eBay
        imageUrl = `https://i.ebayimg.com/images/g/${itemId}/s-l300.jpg`;
      }
      
      return {
        itemId: itemId,
        title: item.title || 'מוצר ללא כותרת',
        viewItemURL: itemWebUrl,
        galleryURL: imageUrl,
        price: parseFloat(item.price?.value),
        currency: item.price?.currency,
        originalPrice: item.marketingPrice?.originalPrice?.value ? parseFloat(item.marketingPrice.originalPrice.value) : null,
        discountPercentage: item.marketingPrice?.discountPercentage,
        seller: item.seller?.username,
        feedbackScore: item.seller?.feedbackScore,
        shippingType: item.shippingOptions?.[0]?.shippingCostType,
        shippingServiceCost: parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || 0),
        shippingCurrency: item.shippingOptions?.[0]?.shippingCost?.currency,
        condition: item.condition,
        itemLocation: item.itemLocation?.country,
        buyingOptions: item.buyingOptions || [],
        adultOnly: item.adultOnly || false,
        ratings: item.feedbackRatings,
        ratingsCount: item.feedbackCount
      };
    });
  } catch (error) {
    console.error('❌ שגיאה כללית בחיפוש מוצרים:', error.message);
    // במקום להחזיר נתוני דמה, נאפשר לשגיאה להתפשט או נחזיר מערך ריק
    // אם השגיאה היא מכשלון בקבלת טוקן, היא כבר תהיה זרוקה מהשורה הראשונה של הבלוק try
    // אם זו שגיאה אחרת (למשל, בעיה ברשת בזמן קריאה ל־eBay), נזרוק אותה הלאה
    // או שנחליט להחזיר מערך ריק אם זה מתאים יותר לקונטקסט של הקריאה לפונקציה זו.
    // כרגע, נבחר לזרוק את השגיאה הלאה כדי שהקוד הקורא יהיה מודע לבעיה.
    throw error;
  }
}

// The function generateSampleDeals is no longer needed as we are removing all calls to it.
// It can be removed entirely.

module.exports = { fetchDealsFromStrategy };
