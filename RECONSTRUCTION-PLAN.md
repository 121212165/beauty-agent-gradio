# Reconstruction Plan

## Current State: ~900 lines across 10 files. 71% waste.

## Target: 2 application files (~260 lines) + config

### Files to DELETE (waste):
- `app.py` - Gradio wrapper, just serves HTML
- `requirements.txt` - Python deps (project is Node.js)
- `server/app.js` - Express server (replaced by Vercel serverless)
- `server/routes/analyze.js` - Express routes (merged into serverless fn)
- `server/utils/aiService.js` - AI service (merged into serverless fn)
- `public/script.js` - Duplicate of inline JS in index.html
- `DEPLOYMENT.md` - Bloated deployment docs
- `.github/workflows/ci.yml` - Unnecessary CI
- `package-lock.json` - Will regenerate

### Files to CREATE:
- `api/analyze.js` (~60 lines) - Vercel serverless function with embedded system prompt

### Files to MODIFY:
- `index.html` (~200 lines) - Remove duplicate JS bloat, keep clean single-page UI
- `vercel.json` (5 lines) - Simple static + API routing
- `package.json` - Remove express/cors/multer deps, keep openai only
- `README.md` - Minimal

### Security:
- No real API keys found in source (only placeholders in DEPLOYMENT.md)
- DEPLOYMENT.md gets deleted anyway
