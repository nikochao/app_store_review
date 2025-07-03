// api.js - 主要 API 檔案
import express from 'express';
import { fetchAllAppStoreReviews } from './app_review.js';
import { fetchAllGooglePlayReviews } from './google_play_review.js';
import { getLastReviewDateFromSheet, appendReviewsToSheet } from './spreadsheet.js'; // 你要自己實作

const app = express();
const PORT = 3000;

app.use(express.json());

// App Store 評論 API
app.get('/reviews/appstore', async (req, res) => {
  const { appId, startDate, endDate, country = 'tw' } = req.query;
  
  if (!appId || !startDate || !endDate) {
    return res.status(400).json({ 
      error: '請提供 appId, startDate, endDate',
      example: '/reviews/appstore?appId=123456789&startDate=2024-01-01&endDate=2024-12-31&country=tw'
    });
  }

  try {
    console.log(`開始抓取 App Store 評論: ${appId}, ${startDate} - ${endDate}, ${country}`);
    const reviews = await fetchAllAppStoreReviews(appId, startDate, endDate, country);
    
    res.json({ 
      platform: 'App Store',
      appId,
      dateRange: { startDate, endDate },
      country,
      count: reviews.length, 
      reviews 
    });
  } catch (error) {
    console.error('App Store API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// Google Play 評論 API
app.get('/reviews/googleplay', async (req, res) => {
  const { appId, startDate, endDate, country = 'tw' } = req.query;
  
  if (!appId || !startDate || !endDate) {
    return res.status(400).json({ 
      error: '請提供 appId, startDate, endDate',
      example: '/reviews/googleplay?appId=com.example.app&startDate=2024-01-01&endDate=2024-12-31'
    });
  }

  try {
    console.log(`開始抓取 Google Play 評論: ${appId}, ${startDate} - ${endDate}`);
    const reviews = await fetchAllGooglePlayReviews(appId, startDate, endDate, country);
    
    res.json({ 
      platform: 'Google Play',
      appId,
      dateRange: { startDate, endDate },
      count: reviews.length, 
      reviews 
    });
  } catch (error) {
    console.error('Google Play API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 同時抓取兩個平台的評論
app.get('/reviews/all', async (req, res) => {
  const { appStoreId, googlePlayId, startDate, endDate, country = 'tw' } = req.query;
  
  if ((!appStoreId && !googlePlayId) || !startDate || !endDate) {
    return res.status(400).json({ 
      error: '請提供至少一個 appStoreId 或 googlePlayId，以及 startDate, endDate',
      example: '/reviews/all?appStoreId=123456789&googlePlayId=com.example.app&startDate=2024-01-01&endDate=2024-12-31'
    });
  }

  try {
    const results = {};
    
    if (appStoreId) {
      console.log(`抓取 App Store 評論: ${appStoreId}`);
      try {
        const appStoreReviews = await fetchAllAppStoreReviews(appStoreId, startDate, endDate, country);
        results.appStore = {
          count: appStoreReviews.length,
          reviews: appStoreReviews
        };
      } catch (error) {
        results.appStore = { error: error.message };
      }
    }
    
    if (googlePlayId) {
      console.log(`抓取 Google Play 評論: ${googlePlayId}`);
      try {
        const googlePlayReviews = await fetchAllGooglePlayReviews(googlePlayId, startDate, endDate, country);
        results.googlePlay = {
          count: googlePlayReviews.length,
          reviews: googlePlayReviews
        };
      } catch (error) {
        results.googlePlay = { error: error.message };
      }
    }

    const totalCount = (results.appStore?.count || 0) + (results.googlePlay?.count || 0);
    
    res.json({
      dateRange: { startDate, endDate },
      totalCount,
      platforms: results
    });
    
  } catch (error) {
    console.error('全平台 API 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 根路徑說明
app.get('/', (req, res) => {
  res.json({
    message: 'App Review Scraper API',
    endpoints: [
      'GET /reviews/appstore?appId=123&startDate=2024-01-01&endDate=2024-12-31&country=tw',
      'GET /reviews/googleplay?appId=com.example.app&startDate=2024-01-01&endDate=2024-12-31',
      'GET /reviews/all?appStoreId=123&googlePlayId=com.example.app&startDate=2024-01-01&endDate=2024-12-31',
      'GET /health'
    ]
  });
});

// 更新評論路由
app.post('/reviews/update', async (req, res) => {
  const { appStoreId, googlePlayId, country = 'tw' } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  if (!appStoreId && !googlePlayId) {
    return res.status(400).json({ error: '請提供至少一個 appStoreId 或 googlePlayId' });
  }

  const results = {};

  try {
    if (appStoreId) {
      const lastDate = await getLastReviewDateFromSheet('appstore', appStoreId, country);
      const reviews = await fetchAllAppStoreReviews(appStoreId, lastDate, today, country);
      await appendReviewsToSheet('appstore', appStoreId, reviews, country);
      results.appStore = { count: reviews.length };
    }
    if (googlePlayId) {
      const lastDate = await getLastReviewDateFromSheet('googleplay', googlePlayId, country);
      const reviews = await fetchAllGooglePlayReviews(googlePlayId, lastDate, today, country);
      await appendReviewsToSheet('googleplay', googlePlayId, reviews, country);
      results.googlePlay = { count: reviews.length };
    }
    res.json({ updated: results, dateRange: { start: '各自最後一筆', end: today } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 同時查詢並寫入兩個平台的評論
app.post('/reviews/all/write', async (req, res) => {
  const { appStoreId, googlePlayId, startDate, endDate, country = 'tw' } = req.body;

  if ((!appStoreId && !googlePlayId) || !startDate || !endDate) {
    return res.status(400).json({
      error: '請提供至少一個 appStoreId 或 googlePlayId，以及 startDate, endDate',
      example: '/reviews/all/write (POST) body: { "appStoreId": "123", "googlePlayId": "com.example.app", "startDate": "2024-01-01", "endDate": "2024-12-31" }'
    });
  }

  const results = {};

  try {
    if (appStoreId) {
      const appStoreReviews = await fetchAllAppStoreReviews(appStoreId, startDate, endDate, country);
      await appendReviewsToSheet('appstore', appStoreId, appStoreReviews, country);
      results.appStore = { count: appStoreReviews.length };
    }
    if (googlePlayId) {
      const googlePlayReviews = await fetchAllGooglePlayReviews(googlePlayId, startDate, endDate, country);
      await appendReviewsToSheet('googleplay', googlePlayId, googlePlayReviews, country);
      results.googlePlay = { count: googlePlayReviews.length };
    }
    res.json({
      message: '評論已寫入 Google Sheet',
      dateRange: { startDate, endDate },
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 App Review API 已啟動: http://localhost:${PORT}`);
  console.log(`📖 API 文檔: http://localhost:${PORT}`);
});

// 352743563
// com.mtk
