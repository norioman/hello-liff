// 来店ポイント用 Google Apps Script
// アクティブなスプレッドシートに紐づける形でデプロイすること
// （スプレッドシートを開いた状態で 拡張機能 > Apps Script）

const SHEET_NAME = 'visits';
const TZ = 'Asia/Tokyo';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    if (action === 'checkin') return json(checkin(body.userId, body.displayName));
    if (action === 'status')  return json(getStatus(body.userId));
    return json({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// 動作確認用（ブラウザでURLを直接開いた時）
function doGet() {
  return json({ ok: true, message: 'visit-point endpoint is alive' });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['userId', 'displayName', 'points', 'lastVisitAt', 'visitCount']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow(sheet, userId) {
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === userId) return i + 2;
  }
  return -1;
}

function todayKey() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function nowStr()  { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

function checkin(userId, displayName) {
  if (!userId) return { ok: false, error: 'userId required' };
  const sheet = getSheet();
  const row = findRow(sheet, userId);
  const today = todayKey();

  if (row === -1) {
    sheet.appendRow([userId, displayName || '', 1, nowStr(), 1]);
    return { ok: true, points: 1, visitCount: 1, alreadyCheckedIn: false, message: '初来店ありがとうございます！+1pt' };
  }

  const lastVisitAt = sheet.getRange(row, 4).getValue();
  const lastDay = lastVisitAt ? Utilities.formatDate(new Date(lastVisitAt), TZ, 'yyyy-MM-dd') : '';
  const points = Number(sheet.getRange(row, 3).getValue()) || 0;
  const visitCount = Number(sheet.getRange(row, 5).getValue()) || 0;

  if (lastDay === today) {
    return { ok: true, points, visitCount, alreadyCheckedIn: true, message: '本日チェックイン済み（24時に再加算可）' };
  }

  const newPoints = points + 1;
  const newCount = visitCount + 1;
  if (displayName) sheet.getRange(row, 2).setValue(displayName);
  sheet.getRange(row, 3).setValue(newPoints);
  sheet.getRange(row, 4).setValue(nowStr());
  sheet.getRange(row, 5).setValue(newCount);
  return { ok: true, points: newPoints, visitCount: newCount, alreadyCheckedIn: false, message: 'チェックイン完了！+1pt' };
}

function getStatus(userId) {
  if (!userId) return { ok: false, error: 'userId required' };
  const sheet = getSheet();
  const row = findRow(sheet, userId);
  if (row === -1) return { ok: true, points: 0, visitCount: 0, lastVisitAt: null };
  const points = Number(sheet.getRange(row, 3).getValue()) || 0;
  const visitCount = Number(sheet.getRange(row, 5).getValue()) || 0;
  const lastVisitAt = sheet.getRange(row, 4).getValue();
  const lastVisitStr = lastVisitAt ? Utilities.formatDate(new Date(lastVisitAt), TZ, 'yyyy-MM-dd HH:mm:ss') : null;
  return { ok: true, points, visitCount, lastVisitAt: lastVisitStr };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
