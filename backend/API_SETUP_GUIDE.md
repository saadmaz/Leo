# Leo Intelligence System - API Setup Guide

To enable real-time intelligence, you must provide valid API keys in your `backend/.env` file. The system will now report in the terminal if keys are missing or placeholders.

## 1. Core Search & Intelligence
*   **SerpAPI** (Google Search): [Get it here](https://serpapi.com/)
    *   Required for: General web search, Reddit, Hacker News.
*   **Firecrawl** (Web Scraping): [Get it here](https://www.firecrawl.dev/)
    *   Required for: Deep page analysis and tech stack detection.
*   **NewsAPI**: [Get it here](https://newsapi.org/)
    *   Required for: Market trends and news sentiment.

## 2. Financial & Corporate
*   **Crunchbase**: [Get it here](https://www.crunchbase.com/home)
    *   Required for: Funding data, employee counts, and competitor profiles.

## 3. Hiring & Social
*   **Adzuna**: [Get it here](https://developer.adzuna.com/)
    *   Required for: Hiring velocity and role sentiment.
*   **Reddit**: [Create App here](https://www.reddit.com/prefs/apps)
    *   Required for: User sentiment and win/loss feedback.

## 4. LLM Providers
*   **OpenAI**: [Get it here](https://platform.openai.com/)
    *   Required for: All "Intelligence" features, synthesis, and report generation.

---

## Troubleshooting
Check the terminal where `python backend/main.py` is running. You will see lines like:
`DEBUG: [SerpAPI] Missing or placeholder API key.`

If you see this, it means the key in your `.env` starts with `your_` or is empty.
