const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');
const { getEbayAccessToken } = require('../auth/ebayAuth');

const CATEGORIES_PATH = path.join(__dirname, '../../data/categories.json');

async function fetchCategoriesFromEbay() {
  const accessToken = await getEbayAccessToken();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. קבל את מזהה עץ הקטגוריות עבור ebay.com
    const treeRes = await axios.get('https://api.ebay.com/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US', { headers });
    const treeId = treeRes.data.categoryTreeId;

    // 2. קבל את עץ הקטגוריות הראשי (שכולל את כל הקטגוריות העיקריות)
    const catsRes = await axios.get(`https://api.ebay.com/commerce/taxonomy/v1/category_tree/${treeId}`, { headers });
    
    // 3. המר את עץ הקטגוריות לרשימה שטוחה - רק 2 רמות (ראשי ותת-ראשי)
    const rootCategory = catsRes.data.rootCategoryNode;
    const flatCategories = [];
    
    // עבור על כל הקטגוריות הראשיות
    for (const mainCategory of rootCategory.childCategoryTreeNodes) {
      const mainCategoryName = mainCategory.category.categoryName;
      const mainCategoryId = mainCategory.category.categoryId;
      
      // הוסף את הקטגוריה הראשית
      flatCategories.push({
        id: mainCategoryId,
        path: mainCategoryName
      });
      
      // הוסף את הקטגוריות המשניות (רמה שנייה בלבד)
      if (mainCategory.childCategoryTreeNodes && mainCategory.childCategoryTreeNodes.length > 0) {
        for (const subCategory of mainCategory.childCategoryTreeNodes) {
          flatCategories.push({
            id: subCategory.category.categoryId,
            path: `${mainCategoryName} > ${subCategory.category.categoryName}`
          });
        }
      }
    }

    // 4. שמור את הקטגוריות לקובץ
    fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(flatCategories, null, 2));
    console.log(`✅ נשמרו ${flatCategories.length} קטגוריות ראשיות ותת-ראשיות ל־categories.json`);
    return flatCategories;
  } catch (err) {
    console.error('❌ שגיאה בקבלת קטגוריות מ־eBay:', err.message);
    return [];
  }
}

function checkIfCategoriesExist() {
  return fs.existsSync(CATEGORIES_PATH);
}

function getCategoriesFromFile() {
  if (!checkIfCategoriesExist()) return [];
  const raw = fs.readFileSync(CATEGORIES_PATH, 'utf-8');
  return JSON.parse(raw);
}

module.exports = {
  checkIfCategoriesExist,
  fetchCategoriesFromEbay,
  getCategoriesFromFile,
  CATEGORIES_PATH,
};
