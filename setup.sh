# Setup & Configuration Script

## Install Dependencies
```bash
npm install googleapis dotenv
```

## Create .env file
Copy `.env.example` to `.env` and add your credentials path:
```bash
cp .env.example .env
```

Then edit `.env` to point to your credentials file:
```
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
```

## Test Connection
```bash
node googleSheets.js
```

## Alternative: Run with explicit credentials path
```bash
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json node googleSheets.js
```

## Error Handling

If you get an `INVALID_LICENSE` or `CLOUD_SOURCE_IMPORT` error:
- Make sure you've enabled the Google Sheets API in your Google Cloud project

If you get an `UNAUTHENTICATED` error:
- Verify your service account JSON file is valid and contains the private key
- Verify the Google Sheet is shared with the service account email

If you get a `TOKEN_FETCH` error:
- Ensure the credentials file path is correct
- Ensure the file is not protected by an overly restrictive permissions schema