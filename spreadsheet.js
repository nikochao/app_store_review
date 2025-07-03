import { google } from 'googleapis';
import fs from 'fs/promises';

const SPREADSHEET_ID = '11H7vXceDLSX3sQHGaK3iPJVikeCTnfO5iRmbWojLMM4';
const SHEET_MAP = {
  appstore: 'AppStoreReviews',    // 你的 sheet 名稱
  googleplay: 'GooglePlayReviews' // 你的 sheet 名稱
};

async function getAuth() {
  const credentials = JSON.parse(await fs.readFile('credentials.json', 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

// 取得最後一筆評論日期
export async function getLastReviewDateFromSheet(platform, appId, country) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetName = SHEET_MAP[platform];

  // 讀取所有資料
  const range = `${sheetName}!A:Z`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return '2023-01-01'; // 沒資料就回預設

  // 找出日期欄位
  const header = rows[0];
  const dateIdx = header.indexOf('date');
  const appIdIdx = header.indexOf('appId');
  const countryIdx = header.indexOf('country');

  // 不過濾 appId/country，直接全部資料
  const filtered = rows.slice(1);

  if (filtered.length === 0) return '2023-01-01';

  // 找最大日期
  const lastDate = filtered
    .map(row => row[dateIdx])
    .sort()
    .pop();

  return lastDate;
}

// 新增評論到 sheet
export async function appendReviewsToSheet(platform, appId, reviews, country) {
  if (!reviews || reviews.length === 0) return;
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetName = SHEET_MAP[platform];

  // 取得 header
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1`,
  });
  const header = headerRes.data.values[0];

  // 取得現有資料（只抓 date 和 author 欄位）
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });
  const rows = dataRes.data.values || [];
  const dateIdx = header.indexOf('date');
  const authorIdx = header.indexOf('author');
  const textIdx = header.indexOf('text');

  // 建立現有評論的 key set
  const existingKeys = new Set(
    rows.map(row => {
      const date = row[dateIdx] || '';
      const author = row[authorIdx] || '';
      const text = row[textIdx] || '';
      const len = text.length;
      const prefix = text.slice(0, 5);
      return `${date}__${author}__${len}__${prefix}`;
    })
  );

  // 計算重複評論數
  let duplicateCount = 0;

  // 過濾掉已存在的評論，並計數
  const newReviews = reviews.filter(r => {
    const text = r.text || '';
    const key = `${r.date || ''}__${r.author || ''}__${text.length}__${text.slice(0, 5)}`;
    if (existingKeys.has(key)) {
      duplicateCount++;
      return false;
    }
    return true;
  });

  if (duplicateCount > 0) {
    console.log(`發現重複評論 ${duplicateCount} 筆（未寫入）`);
  }

  if (newReviews.length === 0) return;

  // 準備寫入資料
  const values = newReviews.map(r =>
    header.map(col =>
      col === 'appId' ? appId :
      col === 'country' ? country :
      r[col] ?? ''
    )
  );

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values },
  });
}