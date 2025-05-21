const express = require('express');
const fs = require('fs');
const path = require('path');
const { generateDailyDeals } = require('./generateDailyDeals');

const app = express();
const port = process.env.PORT || 3000;

// הגדרת תיקיית התצוגות
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// מידלוור לעיבוד נתוני טופס
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// נתיב הבית - דף הניהול
app.get('/', async (req, res) => {
  try {
    // קריאת הגדרות
    const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
    let settings = { send_enabled: true, start_hour: 9, end_hour: 21 };
    
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    
    // בדיקה אם יש דילים בתור
    const dealsPath = path.join(__dirname, '..', 'data', 'daily_deals.json');
    let deals = [];
    let dealsCount = 0;
    
    if (fs.existsSync(dealsPath)) {
      deals = JSON.parse(fs.readFileSync(dealsPath, 'utf8'));
      dealsCount = deals.length;
      
      // הגבל את מספר הדילים להצגה כדי למנוע עומס על הדפדפן
      deals = deals.slice(0, 10);
    }
    
    res.render('index', { 
      settings,
      dealsCount,
      deals,
      currentTime: new Date().toLocaleTimeString('he-IL')
    });
  } catch (err) {
    res.status(500).send(`שגיאה בטעינת הדף: ${err.message}`);
  }
});

// עדכון הגדרות
app.post('/settings', async (req, res) => {
  try {
    const { send_enabled, start_hour, end_hour } = req.body;
    
    const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
    const settings = {
      send_enabled: send_enabled === 'on' || send_enabled === true,
      start_hour: parseInt(start_hour) || 9,
      end_hour: parseInt(end_hour) || 21
    };
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    
    res.redirect('/?success=settings_updated');
  } catch (err) {
    res.status(500).send(`שגיאה בעדכון הגדרות: ${err.message}`);
  }
});

// יצירת דילים חדשים
app.post('/generate-deals', async (req, res) => {
  try {
    const result = await generateDailyDeals();
    
    if (result) {
      res.redirect('/?success=deals_generated');
    } else {
      res.redirect('/?error=deals_generation_failed');
    }
  } catch (err) {
    res.status(500).send(`שגיאה ביצירת דילים: ${err.message}`);
  }
});

// ניקוי תור הדילים
app.post('/clear-deals', async (req, res) => {
  try {
    const dealsPath = path.join(__dirname, '..', 'data', 'daily_deals.json');
    
    if (fs.existsSync(dealsPath)) {
      fs.writeFileSync(dealsPath, JSON.stringify([], null, 2), 'utf8');
    }
    
    res.redirect('/?success=deals_cleared');
  } catch (err) {
    res.status(500).send(`שגיאה בניקוי דילים: ${err.message}`);
  }
});

// הפעלת השרת
app.listen(port, () => {
  console.log(`🌐 ממשק הניהול פועל בכתובת http://localhost:${port}`);
}); 