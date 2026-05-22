/**

 * Google Sheets 조회: Service Account 우선, 없으면 공개 gviz 폴백.

 */



import fs from "fs";

import path from "path";

import { google } from "googleapis";

import {

  fetchAllSheetValuesGviz,

  fetchSheetValuesGviz,

} from "./gvizClient.js";



function hasServiceAccountConfig() {

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return true;

  const credPath =

    process.env.GOOGLE_APPLICATION_CREDENTIALS ||

    path.resolve(process.cwd(), "service-account.json");

  return fs.existsSync(credPath);

}



function loadCredentials() {

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (inline) {

    try {

      return JSON.parse(inline);

    } catch {

      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON 파싱에 실패했습니다.");

    }

  }



  const credPath =

    process.env.GOOGLE_APPLICATION_CREDENTIALS ||

    path.resolve(process.cwd(), "service-account.json");



  if (!fs.existsSync(credPath)) {

    throw new Error(

      "Google 인증 정보가 없습니다. GOOGLE_APPLICATION_CREDENTIALS 또는 GOOGLE_SERVICE_ACCOUNT_JSON을 설정하세요."

    );

  }



  const raw = fs.readFileSync(credPath, "utf8");

  return JSON.parse(raw);

}



let sheetsApi = null;



function getSheetsClient() {

  if (sheetsApi) return sheetsApi;



  const credentials = loadCredentials();

  const auth = new google.auth.GoogleAuth({

    credentials,

    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],

  });



  sheetsApi = google.sheets({ version: "v4", auth });

  return sheetsApi;

}



/**

 * @param {string} spreadsheetId

 * @returns {Promise<{ sheetName: string, values: string[][], gid: string | null }[]>}

 */

async function fetchViaServiceAccount(spreadsheetId) {

  const sheets = getSheetsClient();

  const range = process.env.GOOGLE_SHEETS_RANGE;



  if (range) {

    const res = await sheets.spreadsheets.values.get({

      spreadsheetId,

      range,

    });

    return [

      {

        sheetName: range.split("!")[0] || "시트1",

        gid: null,

        values: res.data.values || [],

      },

    ];

  }



  const meta = await sheets.spreadsheets.get({

    spreadsheetId,

    fields: "sheets.properties(title,sheetId)",

  });



  const tabList = meta.data.sheets ?? [];

  if (!tabList.length) {

    return [{ sheetName: "Sheet1", gid: null, values: [] }];

  }



  const results = await Promise.all(

    tabList.map(async (sheet) => {

      const title = sheet.properties?.title || "Sheet1";

      const gid = sheet.properties?.sheetId;

      const res = await sheets.spreadsheets.values.get({

        spreadsheetId,

        range: title,

      });

      return {

        sheetName: title,

        gid: gid != null ? String(gid) : null,

        values: res.data.values || [],

      };

    })

  );



  return results;

}



/**

 * @param {string} spreadsheetId

 * @returns {Promise<{ sheets: { sheetName: string, values: string[][], gid: string | null }[], source: 'service_account' | 'gviz' }>}

 */

export async function fetchAllSheetValues(spreadsheetId) {

  if (hasServiceAccountConfig()) {

    try {

      const sheets = await fetchViaServiceAccount(spreadsheetId);

      return { sheets, source: "service_account" };

    } catch (err) {

      const msg = String(err.message || "");

      const permissionDenied =

        msg.includes("403") ||

        msg.includes("permission") ||

        msg.includes("Permission");

      if (!permissionDenied) throw err;

      console.warn("[sheets] SA 실패, gviz 폴백 시도:", msg);

    }

  }



  const sheets = await fetchAllSheetValuesGviz(spreadsheetId);

  return { sheets, source: "gviz" };

}



/**

 * @deprecated 단일 시트만 필요할 때 — 첫 탭만 반환

 * @param {string} spreadsheetId

 */

export async function fetchSheetValues(spreadsheetId) {

  const { sheets, source } = await fetchAllSheetValues(spreadsheetId);

  const first = sheets[0]?.values ?? [];

  return { values: first, source };

}


