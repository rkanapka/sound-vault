# Development

SoundVault has two local dev loops:

- `backend/`: FastAPI app and API integrations
- `frontend/`: React app built with Vite and Tailwind

## Tooling

- Python 3.14
- Node 20.19+ or 22.12+ for Vite 7
- npm 11

## Backend

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
NAVIDROME_USER=admin NAVIDROME_PASS=admin PYTHONPATH=backend uvicorn main:app --reload
```

## Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to the backend.

## Quality Checks

### Backend

Run from the repository root with the virtualenv activated:

```bash
ruff check backend/
ruff check --fix backend/
ruff format backend/
pytest
```

### Frontend

Run from `frontend/`:

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run build
```

Use `npm run build` before shipping frontend changes if you want a quick production sanity check.
