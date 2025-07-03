import gplay from 'google-play-scraper';
import fetch from 'node-fetch';

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || null;

export async function fetchAllGooglePlayReviews(appId, startDateStr, endDateStr, country = 'tw') {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  console.log(`開始抓取 Google Play 評論 - App ID: ${appId}, 日期範圍: ${startDateStr} 到 ${endDateStr}`);
  
  try {
    let allReviews = [];
    let nextPaginationToken = null;
    let shouldContinue = true;
    let requestCount = 0;
    const maxRequests = 20; // 限制最大請求次數
    
    while (shouldContinue && requestCount < maxRequests) {
      console.log(`正在抓取第 ${requestCount + 1} 批評論...`);
      
      try {
        const requestOptions = {
          appId: appId,
          // sort: gplay.sort.NEWEST,
          lang: 'zh-TW',
          num: 150, // 每次抓取 150 筆
          country: country
        };
        
        // 如果有 pagination token，加入請求參數
        if (nextPaginationToken) {
          requestOptions.nextPaginationToken = nextPaginationToken;
        }
        
        const response = await gplay.reviews(requestOptions);

        if (!response || !response.data || response.data.length === 0) {
          console.log('沒有更多評論了');
          break;
        }

        // 邊爬邊檢查日期
        for (const review of response.data) {
          const reviewDate = new Date(review.date);
          
          // 如果評論日期早於起始日期，停止爬取
          if (reviewDate < startDate) {
            console.log(`發現早於起始日期的評論 (${review.date})，停止爬取`);
            shouldContinue = false;
            break;
          }
          
          // 如果評論在日期範圍內，加入結果
          if (reviewDate >= startDate && reviewDate <= endDate) {
            allReviews.push({
              date: review.date,
              score: review.score,
              text: review.text,
              version: review.version,
              author: review.userName || 'Anonymous',
              platform: 'Google Play'
            });
          }
        }

        // 更新 pagination token
        nextPaginationToken = response.nextPaginationToken;
        
        // 如果沒有下一頁，停止
        if (!nextPaginationToken) {
          console.log('已到達最後一頁');
          break;
        }

        requestCount++;
        
        // 添加延遲避免被限制
        await new Promise(resolve => setTimeout(resolve, 800));
        
      } catch (pageError) {
        console.error(`第 ${requestCount + 1} 批抓取失敗:`, pageError.message);
        break;
      }
    }

    console.log(`總共抓取了 ${allReviews.length} 筆符合條件的 Google Play 評論`);

    // 發送到 Webhook (如果有設定)
    if (MAKE_WEBHOOK_URL && allReviews.length > 0) {
      await sendToWebhook(allReviews, 'Google Play');
    }

    return allReviews;

  } catch (error) {
    console.error('Google Play 評論抓取錯誤:', error);
    throw new Error(`Google Play 抓取失敗: ${error.message}`);
  }
}

// 發送到 Webhook 的輔助函數 (Google Play 版本)
async function sendToWebhook(reviews, platform) {
  try {
    const webhookResponse = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        count: reviews.length,
        reviews
      })
    });

    if (webhookResponse.ok) {
      console.log(`成功傳送 ${platform} 評論資料到 Webhook`);
    } else {
      console.error(`${platform} Webhook 傳送失敗，狀態碼:`, webhookResponse.status);
    }
  } catch (error) {
    console.error(`${platform} Webhook 傳送錯誤:`, error);
  }
}

// 測試代碼
if (import.meta.url === `file://${process.argv[1]}`) {
  const TEST_APP_ID = 'com.mtk';
  const TEST_START_DATE = '2024-01-01';
  const TEST_END_DATE = '2024-12-31';
  
  console.log('直接執行 google_play_review.js 進行測試...');
  fetchAllGooglePlayReviews(TEST_APP_ID, TEST_START_DATE, TEST_END_DATE)
    .then(reviews => {
      console.log('測試完成！');
      console.log(`取得 ${reviews.length} 筆評論`);
    })
    .catch(error => {
      console.error('測試失敗:', error);
    });
}