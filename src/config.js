require('dotenv').config();

module.exports = {
  EBAY_CLIENT_ID: process.env.EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET: process.env.EBAY_CLIENT_SECRET,
  EBAY_SCOPE: process.env.EBAY_SCOPE || 'https://api.ebay.com/oauth/api_scope',
  EBAY_MARKETPLACE_ID: process.env.EBAY_MARKETPLACE_ID || 'EBAY_US',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_TOKEN,
  TELEGRAM_CHANNEL_ID: process.env.CHANNEL_ID,

  EPN_CAMPAIGN_ID: process.env.EPN_CAMPAIGN_ID
};
