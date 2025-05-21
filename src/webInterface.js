const express = require('express');
const fs = require('fs');
const path = require('path');
const { generateDailyDeals } = require('./generateDailyDeals');
const config = require('./config'); // Import config to access credentials

const app = express();
const port = process.env.PORT || 3000;

// Basic Authentication Middleware
const basicAuthMiddleware = (req, res, next) => {
  const adminUsername = config.WEB_INTERFACE_USERNAME;
  const adminPassword = config.WEB_INTERFACE_PASSWORD;

  // Check if username or password are not set in environment variables
  if (!adminUsername || !adminPassword) {
    console.error('Web interface username or password is not set in environment variables. Denying access.');
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication required. Server configuration error: missing credentials.');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication required.');
  }

  const [authType, authCredentials] = authHeader.split(' ');
  if (authType !== 'Basic') {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication required. Only Basic authentication is supported.');
  }

  const credentials = Buffer.from(authCredentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  if (username === adminUsername && password === adminPassword) {
    return next(); // Credentials are correct
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication failed. Invalid credentials.');
  }
};

// Apply Basic Auth Middleware to all routes
app.use(basicAuthMiddleware);

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
  const dealsPath = path.join(__dirname, '..', 'data', 'daily_deals.json');
  const tempDealsPath = `${dealsPath}.tmp`;

  try {
    // Write an empty array to the temporary file
    fs.writeFileSync(tempDealsPath, JSON.stringify([], null, 2), 'utf8');
    // Rename the temporary file to the actual file
    fs.renameSync(tempDealsPath, dealsPath);
    
    res.redirect('/?success=deals_cleared');
  } catch (err) {
    console.error(`❌ שגיאה בניקוי קובץ הדילים ${dealsPath}:`, err.message);
    // Attempt to clean up the temporary file if it exists
    if (fs.existsSync(tempDealsPath)) {
      try {
        fs.unlinkSync(tempDealsPath);
        console.log('🗑️ הקובץ הזמני של הדילים נמחק (לאחר שגיאת ניקוי)');
      } catch (unlinkErr) {
        console.error(`❌ שגיאה במחיקת הקובץ הזמני של הדילים ${tempDealsPath} (לאחר שגיאת ניקוי):`, unlinkErr.message);
      }
    }
    res.status(500).send(`שגיאה בניקוי דילים: ${err.message}`);
  }
});

// הפעלת השרת
app.listen(port, () => {
  console.log(`🌐 ממשק הניהול פועל בכתובת http://localhost:${port}`);
}); 