# CI / CD

## Pipeline overview

Every push to `main` and every pull request runs two parallel checks:

| Job | What it checks |
|-----|---------------|
| **Frontend — TypeScript** | `tsc --noEmit` + ESLint via `next lint` |
| **Backend — Python** | `pytest backend/tests/` (3 test files, all mocked) |

A third job, **CI passed**, depends on both and is used as the single required status check for branch protection. Deployments are **manual** — this pipeline never pushes to production.

---

## Branch protection setup (GitHub UI)

Do this once after the first CI run:

1. Go to **Settings → Branches → Add rule**
2. Branch name pattern: `main`
3. Enable:
   - [x] Require a pull request before merging
   - [x] Require status checks to pass before merging
     - Search for and add: **CI passed**
   - [x] Require branches to be up to date before merging
   - [x] Do not allow bypassing the above settings

The `CI passed` job fails if either `Frontend — TypeScript` or `Backend — Python` fails, so adding only one required check is enough.

---

## Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**.

The CI tests mock all external services, so no real credentials are needed for the tests to pass. However, add these now so they are available if integration tests are added later.

| Secret name | Where to get it | Used by |
|-------------|----------------|---------|
| `FIREBASE_CREDENTIALS` | Firebase Console → Project Settings → Service Accounts → Generate new private key | Backend (Firebase Admin SDK) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Backend (Claude) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → signing secret | Backend (billing) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | Backend (billing) |
| `EXA_API_KEY` | exa.ai dashboard | Backend (competitor research) |
| `TAVILY_API_KEY` | tavily.com dashboard | Backend (web search) |

### Firebase credentials in CI

The Firebase service account is a JSON file. Encode it as base64 for storage as a secret:

```bash
# macOS/Linux
base64 -i firebase-service-account.json | pbcopy   # copies to clipboard

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("firebase-service-account.json")) | Set-Clipboard
```

Paste the output as the value of `FIREBASE_CREDENTIALS`.

To use it in a workflow step (add before any step that needs Firebase):

```yaml
- name: Setup Firebase credentials
  run: echo "${{ secrets.FIREBASE_CREDENTIALS }}" | base64 -d > firebase-service-account.json
  env:
    FIREBASE_CREDENTIALS: ${{ secrets.FIREBASE_CREDENTIALS }}
```

Then set `FIREBASE_SERVICE_ACCOUNT_PATH: firebase-service-account.json` in the job's `env:` block.

---

## Running checks locally

```bash
# Frontend
cd frontend
npm run typecheck   # TypeScript
npm run lint        # ESLint

# Backend
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest tests/ -v
```

---

## Adding new tests

Backend tests live in `backend/tests/`. Add a new file named `test_<feature>.py`. All three existing test files mock external dependencies (Firebase, Anthropic, Firecrawl) — follow the same pattern so tests don't require live credentials.

Frontend has no test runner configured yet. To add Jest + React Testing Library:

```bash
cd frontend
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

Then add `"test": "jest"` to `package.json` scripts and a `jest.config.ts`. Once a test script exists, add an `npm test` step to the `frontend-typecheck` job in `ci.yml`.
