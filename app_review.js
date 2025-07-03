import store from 'app-store-scraper';
import fetch from 'node-fetch';

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || null;

export async function fetchAllAppStoreReviews(appId, startDateStr, endDateStr, country = 'tw') {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  console.log(`開始抓取 App Store 評論 - App ID: ${appId}, 日期範圍: ${startDateStr} 到 ${endDateStr}, 國家: ${country}`);
  
  try {
    let allReviews = [];
    let page = 1;
    let shouldContinue = true;
    
    while (shouldContinue && page <= 50) { // 增加最大頁數限制
      console.log(`正在抓取第 ${page} 頁評論...`);
      
      try {
        const response = await store.reviews({
          id: appId,
          sort: store.sort.RECENT,
          page: page,
          country: country
        });

        if (!response || response.length === 0) {
          console.log('沒有更多評論了');
          break;
        }

        // 邊爬邊檢查日期
        for (const review of response) {
          const reviewDate = new Date(review.updated);
          
          // 如果評論日期早於起始日期，停止爬取
          if (reviewDate < startDate) {
            console.log(`發現早於起始日期的評論 (${review.updated})，停止爬取`);
            shouldContinue = false;
            break;
          }
          
          // 如果評論在日期範圍內，加入結果
          if (reviewDate >= startDate && reviewDate <= endDate) {
            allReviews.push({
              date: review.updated,
              score: review.score,
              text: review.text,
              version: review.version,
              title: review.title,
              author: review.userName,
              platform: 'App Store'
            });
          }
        }

        page++;
        
        // 添加延遲避免被限制
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (pageError) {
        console.error(`第 ${page} 頁抓取失敗:`, pageError.message);
        break;
      }
    }

    console.log(`總共抓取了 ${allReviews.length} 筆符合條件的評論`);

    // 發送到 Webhook (如果有設定)
    if (MAKE_WEBHOOK_URL && allReviews.length > 0) {
      await sendToWebhook(allReviews, 'App Store');
    }

    return allReviews;

  } catch (error) {
    console.error('App Store 評論抓取錯誤:', error);
    throw new Error(`App Store 抓取失敗: ${error.message}`);
  }
}

// 發送到 Webhook 的輔助函數
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
  const TEST_APP_ID = '123456789';
  const TEST_START_DATE = '2024-01-01';
  const TEST_END_DATE = '2024-12-31';
  const TEST_COUNTRY = 'tw';
  
  console.log('直接執行 app_review.js 進行測試...');
  fetchAllAppStoreReviews(TEST_APP_ID, TEST_START_DATE, TEST_END_DATE, TEST_COUNTRY)
    .then(reviews => {
      console.log('測試完成！');
      console.log(`取得 ${reviews.length} 筆評論`);
    })
    .catch(error => {
      console.error('測試失敗:', error);
    });
}