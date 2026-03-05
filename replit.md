# 地獄の審判 - 悪行バトル

## Overview
A two-player AI battle game. Players upload face photos, and AI analyzes each face to generate character profiles (personality, occupation, hidden darkness). The AI then creates escalating sin confessions on behalf of each character. An AI judge evaluates each round until one character fails to escalate.

## Architecture
- **Backend**: Python Flask (`main.py`) on port 5000
- **Frontend**: Vanilla HTML/CSS/JS served from `templates/` and `static/`
- **AI**: OpenAI gpt-4o via Replit AI Integrations (no API key required)

## Structure
```
main.py                 # Flask app with /analyze, /confess, /judge endpoints
templates/index.html    # Game UI with photo upload
static/style.css        # Dark hell-themed styling
static/app.js           # Client-side game logic (auto-battle flow)
```

## API Endpoints
- `POST /analyze` - Accepts base64 image, returns character profile (name, personality, occupation, darkness)
- `POST /confess` - Generates a confession based on character profile and battle history
- `POST /judge` - Evaluates the latest confession and determines if the battle continues

## Key Details
- OpenAI integration uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars (auto-set by Replit)
- Model: gpt-4o (vision-capable for photo analysis)
- Rate limit retries via `tenacity` library
- Game rules: no murder/arson, confessions must escalate in severity
- Max upload size: 10MB
