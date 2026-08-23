# Deploy Node.js App to Render

Deploy a Node.js/Express app with persistent JSON file storage to Render's free tier using GitHub integration.

## Requirements
- GitHub repo with the app code
- GitHub personal access token with `repo` scope
- Render.com account (free, sign up with GitHub)

## 1. Project Structure
```
project/
├── server.js          # Express app
├── package.json       # "start": "node server.js"
├── public/            # Static files (HTML/CSS/JS)
├── data/              # JSON file storage (auto-created)
├── render.yaml        # Render deployment config
└── .gitignore         # node_modules/, data/*.json, .DS_Store
```

## 2. render.yaml
```yaml
services:
  - type: web
    name: app-name
    env: node
    buildCommand: npm install
    startCommand: npm start
    plan: free
```

## 3. Push to GitHub
```bash
git init && git add -A && git commit -m "Initial commit"
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

If no gh CLI, use curl to create repo:
```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user/repos \
  -d '{"name":"repo-name","private":false}'
git push "https://USER:TOKEN@github.com/USER/REPO.git" main
```

## 4. Deploy to Render
Open `https://render.com/deploy?repo=https://github.com/USER/REPO` — Render auto-detects render.yaml. Sign in with GitHub, approve, and it deploys in ~2 minutes.

Or use Render API directly if you have a Render API key.

## 5. Important Notes
- Render free tier spins down after inactivity — first request wakes it (~30s)
- Filesystem is ephemeral on deploys but persists between requests
- Seed data on first run: check if data files exist, seed if not
- Use `process.env.PORT` for the port (Render sets this)
- Accounts/login must always be seeded (never empty) so users can log in

## 6. Env Variables
Set in Render dashboard → Environment:
- `PORT` — auto-set by Render
- Any API keys, secrets, etc.
