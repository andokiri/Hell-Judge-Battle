# 地獄の審判 - 悪行バトル

## Overview
A two-player "sin confession" battle game where players take turns confessing misdeeds. An AI judge (powered by OpenAI via Replit AI Integrations) evaluates each confession and determines when one player's confession fails to escalate, ending the match.

## Architecture
- **Backend**: Python Flask (`main.py`) on port 5000
- **Frontend**: Vanilla HTML/CSS/JS served from `templates/` and `static/`
- **AI**: OpenAI chat completions via Replit AI Integrations (no API key required)

## Structure
```
main.py                 # Flask app with /judge endpoint
templates/index.html    # Game UI
static/style.css        # Dark theme styling
static/app.js           # Client-side game logic
```

## Key Details
- OpenAI integration uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars (auto-set by Replit)
- Model: gpt-4o (as specified by user's original code)
- Rate limit retries via `tenacity` library
- Game rules: no murder/arson, confessions must escalate in severity
