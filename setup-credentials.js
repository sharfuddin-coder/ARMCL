#!/usr/bin/env node

// Create a service account JSON key file
// Usage: node setup-credentials.js <output-path>

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node setup-credentials.js <output-file.json>');
  console.log('');
  console.log('This creates a service account JSON key file for Google Sheets API access.');
  console.log('');
  console.log('Steps:');
  console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/');
  console.log('2. Create a new project or select an existing one');
  console.log('3. Navigate to APIs & Services > Credentials');
  console.log('4. Click "Create Credentials" > "Service Account"');
  console.log('5. Name your service account');
  console.log('6. Create and download the JSON key file');
  console.log('7. Rename it to the output file path');
  process.exit(1);
}

const outputPath = args[0];

console.log('Service Account Key Generator');
console.log('============================');
console.log('');
console.log('Output file:', path.resolve(outputPath));
console.log('');

const key = {
  type: "service_account",
  project_id: "YOUR_PROJECT_ID",
  private_key_id: "YOUR_PRIVATE_KEY_ID",
  private_key: "YOUR_PRIVATE_KEY",
  client_email: "YOUR_CLIENT_EMAIL",
  client_id: "YOUR_CLIENT_ID",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_secret: "YOUR_CLIENT_SECRET",
  animation_url: "https://apis.google.com/img/animate_2.gif",
};

fs.writeFileSync(outputPath, JSON.stringify(key, null, 2));
console.log('');
console.log('Key file created!');
console.log('');
console.log('Next steps:');
console.log('1. Share your Google Sheet with the service account email');
console.log('   (from the key file: ' + key.client_email + ')');
console.log('2. Update .env file with:');
console.log('   GOOGLE_APPLICATION_CREDENTIALS=' + path.resolve(outputPath));
console.log('3. Run: node googleSheets.js');

module.exports = key;