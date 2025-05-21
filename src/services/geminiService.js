const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// שער המרה חלופי במקרה שהמחיר מגיע בדולרים (למקרה הצורך)
const USD_TO_ILS_RATE = 3.7;

async function filterAndSummarizeDeals(deals) {
  const input = {
    deals: deals.slice(0, 10).map(deal => ({
      title: deal.title,
      price: `${deal.price} ${deal.currency}`,
      currency: deal.currency,
      originalPrice: deal.originalPrice ? `${deal.originalPrice} ${deal.currency}` : null,
      discountPercentage: deal.discountPercentage,
      seller: deal.seller,
      shipping: deal.shippingServiceCost || 0,
      shippingCurrency: deal.shippingCurrency || deal.currency,
      image: deal.galleryURL,
      url: deal.viewItemURL,
      ratings: deal.ratings,
      ratingsCount: deal.ratingsCount,
      category: deal.searchCategory || "מוצרים פרקטיים",
      relevance: deal.searchExplanation || "מוצר במחיר אטרקטיבי לצרכן הישראלי"
    }))
  };

  const prompt = `
הנה רשימת מוצרים מאיביי. כל מוצר משויך לקטגוריה והסבר למה הוא רלוונטי לקהל הישראלי.
עבור כל מוצר, יש ליצור תיאור אטרקטיבי ומושך בעברית, עם שפה שיווקית שתגרום לקוראים לרצות לקנות אותו.

דגשים חשובים:
1. כל התיאורים והטקסטים חייבים להיות בעברית מלאה.
2. השתמש במבנה JSON מדויק כפי שמוגדר בדוגמה למטה.
3. השתמש בשפה שיווקית אותנטית, אטרקטיבית ומלהיבה.
4. המחירים יוצגו בדיוק כפי שהם מופיעים באתר כולל הסימון ₪ או $ לפי המטבע.
5. שים לב שכל מוצר מגיע עם שדות category ו-relevance שמסבירים למה המוצר רלוונטי לישראלים - שלב את המידע הזה בתיאור.
6. בשדה hashtags הוסף 3-5 האשטגים בעברית שרלוונטיים למוצר כולל האשטאג של הקטגוריה.
7. התאם את הכותרת כך שתהיה מושכת ובעברית, ולא תרגום ישיר של הכותרת באנגלית.
8. השתמש באחוז ההנחה המדויק אם קיים, אחרת תעריך הנחה סבירה בהשוואה למחירים בארץ.
9. כל האלמנטים בתבנית הם חובה! אל תשנה את שמות השדות.
10. תן תשומת לב מיוחדת לפורמט ה-JSON המדויק לקבלת תוצאות אמינות.

הנה התבנית המדויקת:

[
  {
    "title": "🎯 מציאות ברשת | דילים והמלצות שוות:",
    "product_title": "כותרת קצרה ומושכת בעברית",
    "price_details": "💰 מחיר מבצע: {sale_price}\\nבמקום {original_price}\\n🔥 {discount}% הנחה!",
    "coupon": "🎁 קופון: {coupon_code}",
    "shipping": "📦 עלות משלוח לישראל: {shipping_cost}. זמן משלוח משוער: {estimated_days} ימים.",
    "highlights": "✨ {feature1}.\\n✨ {feature2}.\\n✨ {feature3}.",
    "rating": "⭐ {rating} ({reviews} דירוגים)",
    "purchase_link": "🛒 לרכישה: {purchase_url}",
    "channel_promotion": "📲 לעוד דילים והנחות הצטרפו לערוץ:\\nhttps://t.me/BestDealsHour",
    "hashtags": ["#האשטאג1", "#האשטאג2", "#האשטאג3"]
  }
]

המידע על המוצרים:
${JSON.stringify(input.deals, null, 2)}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    console.log('התגובה מ-Gemini:', text.substring(0, 200) + '...');

    // נקה את התוצאה מכל סימוני JSON אם קיימים
    const cleanedText = text.replace(/```json|```/g, '').trim();
    
    try {
      // נסה לפרסר את התוצאה כ-JSON
      const parsedResult = JSON.parse(cleanedText);
      
      // וודא שהתוצאה היא מערך ושיש לה אלמנטים
      if (Array.isArray(parsedResult) && parsedResult.length > 0) {
        return parsedResult;
      } else {
        console.error('❌ התגובה מ-Gemini לא מכילה מערך תקין של דילים');
        return createDefaultDeals(deals);
      }
    } catch (jsonErr) {
      console.error('❌ שגיאה בניתוח ה-JSON מתגובת Gemini:', jsonErr.message);
      console.log('ניסיון למצוא JSON תקין בתוך התוכן שהתקבל...');
      
      // ניסיון לחלץ JSON מתוך הטקסט
      const jsonMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          const extractedJson = jsonMatch[0];
          console.log('נמצא JSON אפשרי:', extractedJson.substring(0, 100) + '...');
          const parsedJson = JSON.parse(extractedJson);
          return parsedJson;
        } catch (extractErr) {
          console.error('❌ גם הניסיון לחלץ JSON נכשל:', extractErr.message);
          return createDefaultDeals(deals);
        }
      } else {
        console.error('❌ לא נמצא מבנה JSON בתוך התגובה');
        return createDefaultDeals(deals);
      }
    }
  } catch (err) {
    console.error('❌ שגיאה בקבלת תגובה מ-Gemini:', err.message);
    return createDefaultDeals(deals);
  }
}

/**
 * יוצר תבנית ברירת מחדל לדילים במקרה של כישלון
 */
function createDefaultDeals(deals) {
  console.log('📄 יוצר מבנה ברירת מחדל לדילים...');
  
  return deals.slice(0, 5).map(deal => {
    // הגדר את המחיר בהתאם למטבע
    const price = deal.currency === 'ILS' ? `${Math.round(deal.price)} ₪` : `${deal.price} ${deal.currency}`;
    
    // אם המחיר בדולרים, צריך להמיר לשקלים
    const priceILS = deal.currency === 'ILS' ? deal.price : Math.round(deal.price * USD_TO_ILS_RATE);
    
    // עלות משלוח בהתאם למטבע
    const shippingCost = deal.shippingServiceCost || 0;
    const shippingText = shippingCost === 0 
      ? "חינם! 🤩" 
      : deal.shippingCurrency === 'ILS' 
        ? `${Math.round(shippingCost)} ₪` 
        : `${shippingCost} ${deal.shippingCurrency || deal.currency}`;
    
    // אם יש מחיר מקורי והנחה, השתמש בהם
    const originalPrice = deal.originalPrice 
      ? (deal.currency === 'ILS' ? `${Math.round(deal.originalPrice)} ₪` : `${deal.originalPrice} ${deal.currency}`)
      : `${Math.round(priceILS * 1.2)} ₪`;
    
    const discountPercent = deal.discountPercentage || 20;
    
    // הוסף את הקטגוריה כהאשטאג
    const category = deal.searchCategory || "מוצרים פרקטיים";
    const categoryHashtag = `#${category.replace(/\s+/g, '')}`;
    
    return {
      title: "🎯 מציאות ברשת | דילים והמלצות שוות:",
      product_title: `${deal.title.length > 50 ? `${deal.title.substring(0, 50)}...` : deal.title} - ${category}`,
      price_details: `💰 מחיר מבצע: ${price}\nבמקום ${originalPrice}\n🔥 ${discountPercent}% הנחה!`,
      coupon: "",
      shipping: `📦 עלות משלוח לישראל: ${shippingText}. זמן משלוח משוער: 14-21 ימים.`,
      highlights: `✨ מוצר איכותי מקטגוריית ${category}.\n✨ ${deal.searchExplanation || "מחיר משתלם ביחס למחיר בארץ"}.\n✨ נשלח לישראל.`,
      rating: deal.ratingsCount ? `⭐ ${deal.ratings || 4.3} (${deal.ratingsCount}+ דירוגים)` : "⭐ אין דירוג עדיין",
      purchase_link: `🛒 לרכישה: ${deal.viewItemURL}`,
      channel_promotion: "📲 לעוד דילים והנחות הצטרפו לערוץ:\nhttps://t.me/BestDealsHour",
      hashtags: [categoryHashtag, "#דילים", "#מציאות", "#קניותבאיביי", "#משלוחלישראל"]
    };
  });
}

module.exports = { filterAndSummarizeDeals };
