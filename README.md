# Google Sheets API Connection

## Prerequisites

1. Google Cloud Console project
2. Google Sheet to access
3. Service account JSON key file

## Setup

### 1. Create Service Account Key
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Click **Create Credentials** → **Service Account**
3. Name the account, click **Create and continue**
4. On OAuth 2.0 Client ID screen, click **New Client** → **Service Account** → **Continue** → **Create**
5. Click **Save** to download the JSON key file

### 2. Share Your Google Sheet
1. Open the Google Sheet
2. Click **Share**
3. Add the service account email (from the JSON key) as a reader
4. Click **Send**

### 3. Configure Project
1. Place the credentials JSON at `credentials.json`
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of the credentials file

### 4. Install
```bash
npm install googleapis dotenv
```

### 5. Run
```bash
node googleSheets.js
```

## Files

- `googleSheets.js` - Main connection script
- `setup-credentials.js` - Generates service account key file
- `setup-credentials.sh` - Bash version of setup script
- `.env.example` - Example environment file
- `README.md` - This file