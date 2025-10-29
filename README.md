# Company Validator Chrome Extension

Company Validator helps job seekers avoid fake or inactive job postings, accelerate legitimate applications, and protect their personal information. The extension combines AI-powered company vetting, secure application autofill, spreadsheet-based tracking, and email aliasing to bring transparency and trust to modern job searches.

## Key Features

### 🔵 Trust Score for Companies
- Aggregates hiring activity, public reviews, job repost frequency, and state business registry data to produce an actionable trust score.
- Highlights ghost jobs, repeated reposts, and suspected scam listings.
- Verifies employer identities with state licensing and business registration databases.

### 🟢 Autofill Job Applications
- Uses structured resume data stored locally to autofill Workday, Greenhouse, Lever, and other major applicant tracking systems (ATS).
- Speeds up applications while maintaining accuracy and minimizing repetitive form filling.

### 🟣 Application Tracking (Google Sheets)
- Syncs every application to a personal Google Sheet through the Google Sheets API and OAuth2 authentication.
- Creates a centralized log of employers, positions, submission dates, and responses.

### 🟡 Email Alias Protection
- Generates unique email aliases (e.g., `yourname+company@gmail.com`) for each application.
- Tracks whether companies share or misuse provided contact information.

## Architecture Overview

| Component | Technology | Responsibilities |
| --- | --- | --- |
| **Frontend** | Chrome Extension (TypeScript) | Injects UI into job boards, displays trust scores, triggers autofill, and records Google Sheets sync status. Integrates Google OAuth and manages local storage caches for resume/profile data. |
| **Backend** | Python services | Scrapes government business registrations and public directories, evaluates job listings with NLP/ML for scam detection, aggregates trust indicators, and exposes REST endpoints for the extension. |

## Data & Integrations

- **Google OAuth & Sheets API** (personal free tier):
  - <https://developers.google.com/sheets/api>
  - <https://developers.google.com/identity/oauth2/web>
- **State & Local Business Registries** (public APIs), e.g.:
  - <https://businesssearch.sos.ca.gov>
  - <https://opencorporates.com>
- **Company Reviews & Hiring Activity** (public pages, carefully scraped):
  - Glassdoor and Indeed company profiles
  - LinkedIn employee headcount and hiring signals
- **Scam Detection Dataset**:
  - <https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction>

## Why It Matters

- Filters out ghost jobs, repost traps, and scam postings before candidates invest time.
- Improves response rates by focusing efforts on employers that are actively hiring.
- Protects personal data and highlights potential email misuse.
- Encourages transparent and ethical hiring practices across the job market.

## Local Development

### Extension build

1. Install JavaScript dependencies:
   ```bash
   npm install
   ```
2. Generate the placeholder icons (the repository excludes binary assets by default):
   ```bash
   python scripts/generate_icons.py
   ```
3. Build the TypeScript sources:
   ```bash
   npm run build
   ```
   This emits production-ready scripts under `dist/` that are referenced by the manifest. The directory is gitignored, so rebuild it locally whenever needed.
4. Update `manifest.json` with your Google OAuth client ID and any custom API base URL you plan to use.
5. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`.
   - Enable **Developer mode**.
   - Choose **Load unpacked** and select this repository folder.
6. Open the **Company Validator** options page to populate resume details, Google Sheet ID, and alias preferences.
7. Visit a supported job board (LinkedIn, Indeed, Workday, Greenhouse, Lever) to view the injected trust panel, autofill applications, and log submissions to your tracker.

### Python trust service

1. Create a virtual environment and install backend dependencies:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Start the API server:
   ```bash
   uvicorn app.main:app --reload
   ```
The extension defaults to `http://localhost:8000/api/v1` for trust score and application sync requests.

## Troubleshooting

### GitHub mobile pull request error `(400, 096be5b9ebff90861b5-BOS)`

GitHub's mobile client can return a generic `400` error when a branch only exists locally or when required fields are missing
from the request payload. Publish the branch before opening the pull request from the app:

```bash
git push origin work
```

After the branch is on GitHub, restart the PR flow. If the error persists, confirm the PR includes both a title and description,
because GitHub treats an empty body as an invalid request in some clients.

