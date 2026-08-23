const { Sheets } = require('@googleapis/sheets');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const auth = new GoogleAuth({
  keyFile: credentialsPath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = new Sheets({ auth });

async function getSheetData(spreadsheetId, range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error reading sheet:', error.message);
    throw error;
  }
}

async function main() {
  const spreadsheetId = process.env.SPREADSHEET_ID || 'YOUR_SPREADSHEET_ID';
  const range = process.env.READ_RANGE || 'Sheet1!A1:Z100';

  try {
    const values = await getSheetData(spreadsheetId, range);
    console.log(`Sheet: ${spreadsheetId}, Range: ${range}`);
    console.log(`Total rows: ${values.length}`);
    if (values.length > 0) {
      console.log('Headers:', values[0]);
      console.log('\nData:');
      values.forEach((row, i) => {
        console.log(`Row ${i + 1}: ${row.join(' | ')}`);
      });
    }
  } catch (error) {
    console.error('Failed to connect to Google Sheets API');
    process.exit(1);
  }
}

main();