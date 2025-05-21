const { getCategoriesFromFile } = require('./categoryFetcher');

// מערך הנישות החדש שלך (ייבוא או הדבקה כאן)
const ISRAELI_AUDIENCE_NICHES = [
  {
    "name": "גאדג'טים וחידושים טכנולוגיים לבית חכם",
    "keywords": ["smart home gadgets", "home automation", "smart lighting", "smart security", "voice assistant"],
    "categories": [
      "Consumer Electronics > Surveillance & Smart Home Electronics",
      "Consumer Electronics > Smart Glasses",
      "Consumer Electronics > Virtual Reality",
      "Home & Garden > Lamps, Lighting & Ceiling Fans"
    ],
    "audience": "home_users",
    "why": "מוצרים אלה מאפשרים שדרוג טכנולוגי של הבית, לעיתים קרובות במחירים נמוכים משמעותית מהמקבילים בשוק המקומי. השליטה מרחוק והאוטומציה נוחים מאוד ומשפרים את איכות החיים."
  },
  {
    "name": "צעצועים התפתחותיים ומשחקי קופסה לילדים",
    "keywords": ["educational toys", "developmental toys", "board games for kids", "STEM toys", "puzzle games"],
    "categories": [
      "Toys & Hobbies > Educational",
      "Toys & Hobbies > Puzzles",
      "Toys & Hobbies > Games",
      "Toys & Hobbies > Preschool Toys & Pretend Play",
      "Baby > Toys for Baby"
    ],
    "audience": "parents",
    "why": "מגוון רחב של צעצועים חינוכיים ומשחקים שלא תמיד זמינים בארץ או זמינים במחירים גבוהים. רכישה מאיביי מאפשרת למצוא מוצרים ייחודיים התומכים בלמידה והתפתחות הילד בעלות נמוכה יותר."
  },
  {
    "name": "אופנת וינטג' ורטרו ייחודית",
    "keywords": ["vintage clothing", "retro fashion", "antique jewelry", "vintage accessories", "second hand designer"],
    "categories": [
      "Clothing, Shoes & Accessories > Specialty > Vintage",
      "Clothing, Shoes & Accessories > Women > Women's Vintage Clothing",
      "Clothing, Shoes & Accessories > Men > Men's Vintage Clothing",
      "Jewelry & Watches > Vintage & Antique Jewelry",
      "Collectibles > Vintage, Retro, Mid-Century"
    ],
    "audience": "fashion_enthusiasts",
    "why": "איביי הוא מקור מצוין למציאת פריטי אופנה ייחודיים מתקופות שונות, שקשה עד בלתי אפשרי למצוא בישראל. זו הזדמנות לרכוש פריטים עם סיפור ואופי במחירים אטרקטיביים."
  },
  {
    "name": "פריטי אספנות נדירים ומזכרות",
    "keywords": ["rare collectibles", "sports memorabilia", "comic books", "antique coins", "stamps collection"],
    "categories": [
      "Collectibles > Comic Books & Memorabilia",
      "Collectibles > Autographs",
      "Sports Mem, Cards & Fan Shop > Sports Trading Cards",
      "Sports Mem, Cards & Fan Shop > Vintage Sports Memorabilia",
      "Coins & Paper Money > Coins: World",
      "Stamps > Topical Stamps"
    ],
    "audience": "collectors",
    "why": "שוק האספנות באיביי הוא עצום ומאפשר למצוא פריטים נדירים מכל העולם. עבור אספנים ישראלים, זוהי דרך להגיע לפריטים שלא זמינים בשוק המקומי ולהשלים אוספים."
  },
  {
    "name": "ציוד ספורט וכושר מקצועי וביתי",
    "keywords": ["fitness equipment", "home gym", "yoga accessories", "cycling gear", "running shoes"],
    "categories": [
      "Sporting Goods > Fitness, Running & Yoga",
      "Sporting Goods > Cycling",
      "Sporting Goods > Indoor Games",
      "Sporting Goods > Team Sports"
    ],
    "audience": "fitness_enthusiasts",
    "why": "ניתן למצוא מגוון רחב של ציוד ספורט, אביזרים וביגוד ממותגים מובילים במחירים תחרותיים. לעיתים, דגמים מסוימים או מידות ספציפיות זמינים רק דרך פלטפורמות בינלאומיות כמו איביי."
  },
  {
    "name": "אביזרים וחלקי חילוף לרכב",
    "keywords": ["car accessories", "car parts", "vehicle electronics", "car cleaning tools", "motorcycle gear"],
    "categories": [
      "Vehicle Parts & Accessories",
      "Consumer Electronics > Vehicle Electronics & GPS"
    ],
    "audience": "car_owners",
    "why": "שוק חלקי החילוף והאביזרים לרכב באיביי מציע מגוון עצום, כולל חלקים מקוריים (OEM) וחלקים תחליפיים במחירים נמוכים משמעותית מהמוסכים והחנויות בישראל. זה מאפשר תחזוקה ושיפור הרכב בעלות מופחתת."
  },
  {
    "name": "כלי עבודה וציוד לבית ולגינה",
    "keywords": ["power tools", "hand tools", "gardening equipment", "DIY tools", "workshop supplies"],
    "categories": [
      "Home & Garden > Tools & Workshop Equipment",
      "Home & Garden > Yard, Garden & Outdoor Living",
      "Business & Industrial > Light Equipment & Tools"
    ],
    "audience": "home_improvement_enthusiasts",
    "why": "חובבי עשה-זאת-בעצמך (DIY) ובעלי בתים יכולים למצוא מגוון רחב של כלי עבודה וציוד לבית ולגינה במחירים אטרקטיביים, כולל מותגים שלא תמיד מיובאים לישראל."
  },
  {
    "name": "ציוד משרדי ופתרונות אחסון לעסקים קטנים ופרילנסרים",
    "keywords": ["office supplies", "ergonomic chair", "desk organizer", "small business equipment", "home office setup"],
    "categories": [
      "Business & Industrial > Office",
      "Computers/Tablets & Networking > Laptop & Desktop Accessories",
      "Home & Garden > Furniture"
    ],
    "audience": "small_business_owners_freelancers",
    "why": "עסקים קטנים ופרילנסרים יכולים לחסוך עלויות משמעותיות ברכישת ציוד משרדי, ריהוט ארגונומי ופתרונות טכנולוגיים דרך איביי, מה שמאפשר להם לייעל את סביבת העבודה בתקציב נמוך יותר."
  },
  {
    "name": "מוצרי טיפוח ויופי ייחודיים ומותגים קוריאניים",
    "keywords": ["korean skincare", "beauty products", "makeup sets", "natural cosmetics", "hair care tools"],
    "categories": [
      "Health & Beauty > Skin Care",
      "Health & Beauty > Makeup",
      "Health & Beauty > Hair Care & Styling",
      "Health & Beauty > Fragrances"
    ],
    "audience": "beauty_enthusiasts",
    "why": "איביי מציע גישה למותגי טיפוח ויופי מכל העולם, כולל מותגים קוריאניים פופולריים, שלא תמיד זמינים בישראל או נמכרים במחירים גבוהים. ניתן למצוא מוצרים ייחודיים וחדשניים."
  },
  {
    "name": "ציוד ואביזרים לחיות מחמד",
    "keywords": ["pet supplies", "dog accessories", "cat toys", "aquarium equipment", "bird cages"],
    "categories": [
      "Pet Supplies > Dog Supplies",
      "Pet Supplies > Cat Supplies",
      "Pet Supplies > Fish & Aquariums",
      "Pet Supplies > Bird Supplies"
    ],
    "audience": "pet_owners",
    "why": "בעלי חיות מחמד יכולים למצוא מגוון רחב של ציוד, צעצועים, מזון ואביזרים לחיות המחמד שלהם במחירים תחרותיים יותר מאשר בחנויות המקומיות, כולל פריטים ייחודיים וחדשניים."
  },
  {
    "name": "אביזרי מטבח וגאדג'טים לבישול ואפייה",
    "keywords": ["kitchen gadgets", "baking tools", "cooking utensils", "coffee accessories", "small kitchen appliances"],
    "categories": [
      "Home & Garden > Kitchen, Dining & Bar",
      "Home & Garden > Major Appliances",
      "Collectibles > Kitchen & Home"
    ],
    "audience": "home_cooks_bakers",
    "why": "חובבי בישול ואפייה יכולים למצוא באיביי מגוון עצום של אביזרים, גאדג'טים וכלי מטבח מיוחדים שלא תמיד זמינים בארץ, ובמחירים שיכולים להיות נמוכים משמעותית."
  },
  {
    "name": "מוצרי תינוקות וציוד להורים טריים",
    "keywords": ["baby gear", "strollers", "baby clothes", "nursery decor", "feeding supplies"],
    "categories": [
      "Baby",
      "Baby > Strollers & Accessories",
      "Baby > Diapering",
      "Baby > Feeding",
      "Clothing, Shoes & Accessories > Baby"
    ],
    "audience": "new_parents",
    "why": "הורים טריים יכולים למצוא מגוון רחב של מוצרי תינוקות, החל מעגלות ובגדים ועד צעצועים וציוד האכלה, במחירים אטרקטיביים. לעיתים קרובות ניתן למצוא מותגים בינלאומיים שאינם נמכרים בארץ."
  },
  {
    "name": "ציוד צילום מקצועי וחובבני",
    "keywords": ["dslr camera", "mirrorless camera", "camera lenses", "tripods", "studio lighting", "drones"],
    "categories": [
      "Cameras & Photo > Digital Cameras",
      "Cameras & Photo > Lenses & Filters",
      "Cameras & Photo > Tripods & Supports",
      "Cameras & Photo > Lighting & Studio",
      "Cameras & Photo > Camera Drones"
    ],
    "audience": "photographers_videographers",
    "why": "צלמים מקצועיים וחובבים יכולים למצוא באיביי ציוד צילום מגוון, כולל מצלמות, עדשות, חצובות ואביזרים נלווים, לעיתים קרובות במחירים נמוכים יותר מאשר בחנויות המקומיות, ובמיוחד בשוק היד שנייה."
  },
  {
    "name": "כלי נגינה ואביזרים למוזיקאים",
    "keywords": ["electric guitar", "acoustic guitar", "keyboard piano", "drum set", "ukulele", "music accessories"],
    "categories": [
      "Musical Instruments & Gear > Guitars & Basses",
      "Musical Instruments & Gear > Pianos, Keyboards & Organs",
      "Musical Instruments & Gear > Percussion",
      "Musical Instruments & Gear > String",
      "Musical Instruments & Gear > General Accessories"
    ],
    "audience": "musicians",
    "why": "מוזיקאים יכולים למצוא מגוון רחב של כלי נגינה, חדשים ומשומשים, ואביזרים נלווים במחירים תחרותיים. איביי מציעה גישה למותגים ודגמים שלא תמיד זמינים בישראל."
  },
  {
    "name": "ציוד לקמפינג וטיולים בטבע",
    "keywords": ["camping gear", "hiking backpack", "tent", "sleeping bag", "outdoor cooking"],
    "categories": [
      "Sporting Goods > Camping & Hiking",
      "Sporting Goods > Outdoor Sports",
      "Home & Garden > Yard, Garden & Outdoor Living"
    ],
    "audience": "outdoor_enthusiasts",
    "why": "חובבי טבע וטיולים יכולים למצוא ציוד קמפינג איכותי, אוהלים, שקי שינה, תרמילים ואביזרים נוספים במחירים אטרקטיביים, כולל מותגים בינלאומיים מובילים."
  },
  {
    "name": "משחקי וידאו, קונסולות ואביזרים גיימינג",
    "keywords": ["video games", "gaming console", "PC gaming", "gaming headset", "retro gaming", "VR games"],
    "categories": [
      "Video Games & Consoles > Video Games",
      "Video Games & Consoles > Video Game Consoles",
      "Video Games & Consoles > Video Game Accessories",
      "Consumer Electronics > Virtual Reality"
    ],
    "audience": "gamers",
    "why": "גיימרים יכולים למצוא משחקים חדשים ומשומשים, קונסולות, אביזרים היקפיים ופריטי אספנות הקשורים לעולם הגיימינג. לעיתים קרובות ניתן למצוא מהדורות מיוחדות או משחקי רטרו שאינם זמינים בארץ."
  },
  {
    "name": "תכשיטים בעבודת יד ואבני חן",
    "keywords": ["handmade jewelry", "gemstone rings", "silver necklace", "custom earrings", "loose gemstones"],
    "categories": [
      "Jewelry & Watches > Handcrafted & Artisan Jewelry",
      "Jewelry & Watches > Loose Diamonds & Gemstones",
      "Jewelry & Watches > Fine Jewelry",
      "Crafts > Beads & Jewelry Making"
    ],
    "audience": "jewelry_lovers_crafters",
    "why": "איביי הוא מקור מצוין לתכשיטים ייחודיים בעבודת יד ממעצבים קטנים ברחבי העולם, וכן לאבני חן וחומרי גלם ליצירת תכשיטים עצמאית. המחירים לרוב אטרקטיביים יותר מאשר בחנויות בוטיק."
  },
  {
    "name": "ספרים נדירים, מהדורות ראשונות וספרי קריאה באנגלית",
    "keywords": ["rare books", "first edition books", "english novels", "collectible books", "out of print books"],
    "categories": [
      "Books & Magazines > Antiquarian & Collectible",
      "Books & Magazines > Books",
      "Collectibles > Paper"
    ],
    "audience": "book_lovers_collectors",
    "why": "חובבי ספרים ואספנים יכולים למצוא מגוון עצום של ספרים באנגלית, כולל מהדורות נדירות, ספרים שאזלו מהדפוס וספרות מקצועית, לעיתים קרובות במחירים נמוכים משמעותית מהחנויות המקומיות (אם בכלל זמינים)."
  },
  {
    "name": "ציוד אלקטרוניקה ומחשבים משומש ומחודש",
    "keywords": ["used laptop", "refurbished smartphone", "second hand tablet", "computer components", "vintage electronics"],
    "categories": [
      "Computers/Tablets & Networking > Laptops & Netbooks",
      "Computers/Tablets & Networking > Desktops & All-In-Ones",
      "Computers/Tablets & Networking > Tablets & eBook Readers",
      "Cell Phones & Accessories > Cell Phones & Smartphones",
      "Consumer Electronics > Vintage Electronics"
    ],
    "audience": "tech_savvy_budget_conscious",
    "why": "רכישת אלקטרוניקה משומשת או מחודשת באיביי יכולה לחסוך מאות ואף אלפי שקלים. זו אופציה מצוינת לסטודנטים, אנשים עם תקציב מוגבל, או כאלה שמחפשים דגמים ישנים יותר שלא נמכרים עוד בחנויות."
  },
  {
    "name": "פריטי עיצוב לבית בסגנונות שונים (מודרני, כפרי, בוהו)",
    "keywords": ["home decor", "wall art", "decorative pillows", "vases", "boho decor", "farmhouse style"],
    "categories": [
      "Home & Garden > Home Décor",
      "Home & Garden > Pillows",
      "Home & Garden > Rugs & Carpets",
      "Collectibles > Decorative Collectibles",
      "Art > Art Prints"
    ],
    "audience": "home_decorators",
    "why": "איביי מציע מגוון עצום של פריטי עיצוב לבית בכל סגנון ותקציב, כולל פריטים ייחודיים שלא ניתן למצוא בחנויות הרשת בישראל. זו דרך מצוינת להוסיף אופי אישי לבית בעלות נמוכה."
  },
  {
    "name": "ציוד למלאכות יד ויצירה",
    "keywords": ["craft supplies", "sewing machine", "knitting yarn", "scrapbooking tools", "art supplies"],
    "categories": [
      "Crafts > Sewing",
      "Crafts > Needlecrafts & Yarn",
      "Crafts > Scrapbooking & Paper Crafts",
      "Crafts > Art Supplies",
      "Crafts > Multi-Purpose Craft Supplies"
    ],
    "audience": "crafters_hobbyists",
    "why": "חובבי יצירה יכולים למצוא באיביי מגוון רחב של חומרי גלם, כלים ואביזרים למלאכות יד שונות, לעיתים במחירים טובים יותר ומבחר גדול יותר מאשר בחנויות המקומיות."
  }
];

/**
 * מחולל אסטרטגיה רנדומלית
 */
async function generateStrategies() {
  const allCategories = getCategoriesFromFile();

  // בחר 3–5 נישות שונות אקראיות
  const shuffled = [...ISRAELI_AUDIENCE_NICHES].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 3);

  const keywords = selected.flatMap(niche => {
    const k = [...niche.keywords].sort(() => 0.5 - Math.random());
    return k.slice(0, Math.floor(Math.random() * 2) + 1);
  }).slice(0, 6);

  const categoryIds = new Set();
  for (const niche of selected) {
    for (const cat of allCategories) {
      const path = cat.path.toLowerCase();
      if (niche.categories.some(c => path.includes(c.toLowerCase()))) {
        categoryIds.add(cat.id);
        if (categoryIds.size >= 5) break;
      }
    }
    if (categoryIds.size >= 5) break;
  }

  return {
    strategy_id: 'israeli_ai_strategy',
    keywords,
    category_ids: [...categoryIds],
    max_price_usd: Math.floor(Math.random() * 30) + 10,
    min_price_usd: Math.floor(Math.random() * 5) + 1,
    prefer_free_shipping: Math.random() > 0.3,
    target_audience: 'israeli_shoppers',
    seasonality: ['all_year'],
    priority: 5,
    niches: selected.map(n => n.name)
  };
}

module.exports = { generateStrategies };
