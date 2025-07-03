# App Review Scraper API 文件

## Base URL

```
http://localhost:3000
```

---

## 1. 健康檢查

**GET** `/health`

**回應範例：**
```json
{ "status": "ok" }
```

---

## 2. 取得 App Store 評論

**GET** `/reviews/appstore`

**參數：**
- `appId` (必填)：App Store 應用程式 ID
- `startDate` (必填)：起始日期（YYYY-MM-DD）
- `endDate` (必填)：結束日期（YYYY-MM-DD）
- `country` (選填，預設 tw)：國家代碼

**範例：**
```
GET /reviews/appstore?appId=352743563&startDate=2024-01-01&endDate=2024-07-03&country=tw
```

---

## 3. 取得 Google Play 評論

**GET** `/reviews/googleplay`

**參數：**
- `appId` (必填)：Google Play 應用程式 ID
- `startDate` (必填)：起始日期（YYYY-MM-DD）
- `endDate` (必填)：結束日期（YYYY-MM-DD）
- `country` (選填，預設 tw)：國家代碼

**範例：**
```
GET /reviews/googleplay?appId=com.mtk&startDate=2024-01-01&endDate=2024-07-03
```

---

## 4. 同時取得兩平台評論

**GET** `/reviews/all`

**參數：**
- `appStoreId` (選填)：App Store 應用程式 ID
- `googlePlayId` (選填)：Google Play 應用程式 ID
- `startDate` (必填)：起始日期（YYYY-MM-DD）
- `endDate` (必填)：結束日期（YYYY-MM-DD）

**範例：**
```
GET /reviews/all?appStoreId=352743563&googlePlayId=com.mtk&startDate=2024-01-01&endDate=2024-07-03
```

---

## 5. 自動更新評論並寫入 Google Sheet

**POST** `/reviews/update`

**Body 範例：**
```json
{
  "appStoreId": "352743563",
  "googlePlayId": "com.mtk"
}
```
- 會自動偵測 Google Sheet 目前最新日期，抓取新評論並寫入。

---

## 6. 查詢並寫入評論（指定日期範圍）

**POST** `/reviews/all/write`

**Body 範例：**
```json
{
  "appStoreId": "352743563",
  "googlePlayId": "com.mtk",
  "startDate": "2024-01-01",
  "endDate": "2024-07-03"
}
```
- 會查詢指定日期範圍的評論並寫入 Google Sheet。

---

## 7. 回應格式

所有評論 API 回傳格式大致如下：

```json
{
  "platform": "App Store",
  "appId": "352743563",
  "dateRange": { "startDate": "2024-01-01", "endDate": "2024-07-03" },
  "country": "tw",
  "count": 10,
  "reviews": [
    {
      "date": "2024-06-30",
      "score": 5,
      "text": "很棒的應用程式！",
      "version": "1.2.3",
      "author": "user123"
    }
  ]
}
```

---

## 8. 常見錯誤

- 缺少必要參數時，會回傳 400 錯誤與範例。
- 伺服器錯誤時，會回傳 500 錯誤與錯誤訊息。

---

## 9. 測試指令（curl 範例）

```sh
curl "http://localhost:3000/reviews/appstore?appId=352743563&startDate=2024-01-01&endDate=2024-07-03"
```

```sh
curl -X POST http://localhost:3000/reviews/update \
  -H "Content-Type: application/json" \
  -d '{"appStoreId":"352743563","googlePlayId":"com.mtk"}'
```

---

如需更多協助，請參考原始碼或聯絡維護者。