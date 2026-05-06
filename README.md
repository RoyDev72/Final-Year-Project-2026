# Final Year Project 2026

A full-stack social hub and floor-plan estimation application built with React, Express, MongoDB, and a PaddleOCR microservice. The app supports authentication, project management, admin pricing/branding controls, floor-plan upload, OCR extraction, and generated estimation output.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS
- **Backend:** Node.js, Express, MongoDB, Mongoose, JWT authentication
- **OCR service:** Python, Flask, PaddleOCR, OpenCV headless
- **AI integrations:** Google Gemini and Google Cloud Vision support

## Project Structure

```text
.
├── client/        # React + Vite frontend
├── server/        # Express API and MongoDB models
└── ocr-service/   # Flask PaddleOCR microservice
```

## Prerequisites

- Node.js 20+
- Python 3.10+
- MongoDB Atlas or another MongoDB connection string
- PaddleOCR-compatible CPU environment

## Environment Variables

Create `server/.env` locally. Do not commit this file.

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
ADMIN_EMAIL=admin@example.com

OCR_MICROSERVICE_URL=http://localhost:7001/ocr
OCR_SERVICE_TIMEOUT_MS=90000
USE_OPENCV=false

GEMINI_API_KEY=optional_gemini_api_key
GOOGLE_CLOUD_CREDENTIALS_JSON=optional_google_service_account_json
```

Create `client/.env` locally if the frontend needs a custom API URL.

```env
VITE_API_URL=http://localhost:5000
```

## Local Setup

Install and run the backend:

```bash
cd server
npm install
npm run dev
```

Install and run the frontend:

```bash
cd client
npm install
npm run dev
```

Install and run the OCR microservice:

```bash
cd ocr-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The services run on these default URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- OCR microservice: `http://localhost:7001`

## Main API Areas

- `GET /` - API health text
- `/api/auth` - user authentication
- `/api/projects` - project management
- `/api/admin` - admin pricing and branding
- `/api/floorplan` - floor-plan processing
- `/api/ocr` - OCR routes

## Deployment Notes

- Keep the React frontend on Vercel, Netlify, or another static hosting provider.
- Deploy the Express API and OCR service on a VPS such as DigitalOcean.
- Use at least 2 vCPU and 4 GB RAM for PaddleOCR; 4 vCPU and 8 GB RAM is better for smoother OCR processing.
- Store production secrets in the hosting provider's environment settings.
- Make sure uploaded files, generated files, virtual environments, and `.env` files stay out of Git.

## Security Notes

- Rotate any database passwords or JWT secrets that have ever been shared publicly.
- Use a long random value for `JWT_SECRET`.
- Restrict MongoDB Atlas network access where possible.
- Never commit service account JSON files or local `.env` files.

## Useful Commands

```bash
# Frontend production build
cd client
npm run build

# Backend production start
cd server
npm start

# OCR health check
curl http://localhost:7001/health
```
