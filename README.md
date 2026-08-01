# DineX Restaurant Website

Local full-stack restaurant website: static HTML/CSS/JS frontend served by a Node.js + Express backend, with MySQL for storage.

## Prerequisites

- Node.js 20+ (tested on v26)
- MySQL 8+ running locally
  - macOS: `brew install mysql && brew services start mysql`

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the database (tables are created automatically on server start)
mysql -u root -e "CREATE DATABASE IF NOT EXISTS dinex_restaurant;"

# 3. Configure environment
cp .env.example .env
# Edit .env: set DB_PASSWORD (leave empty for a fresh Homebrew MySQL root user)
# and choose ADMIN_USER_ID / ADMIN_PASSWORD for the admin dashboard.

# 4. Run
npm start
```

Open http://localhost:3000 — the server serves the site and the API together.

## Project structure

```
public/            Web root — the only directory served over HTTP
  *.html           Pages (served at /index.html, /menu.html, …)
  css/style.css    Stylesheet
  js/              Frontend scripts (config, forms, reviews, admin)
  images/          All image assets
src/               Backend (not web-reachable)
  server.js        Express app + API routes
  db.js            MySQL pool + schema bootstrap
db/schema.sql      Table definitions, applied on server start
package.json       Dependencies and npm scripts
.env               Local config (DB + admin credentials; git-ignored)
```

Because only `public/` is served, backend code and secrets are never reachable over HTTP.

## Pages

| URL | Page |
|---|---|
| `/` | Home |
| `/menu.html` | Menu |
| `/gallary.html` | Gallery |
| `/review.html` | Reviews (submit + latest 20) |
| `/order.html` | Order type chooser |
| `/delivery.html` | Delivery order form |
| `/takein.html` | Takeaway order form |
| `/booking.html` | Table booking form |
| `/admin-login.html` | Admin login (credentials from `.env`) |
| `/admin-dashboard.html` | Admin order/booking review with status updates |

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server + DB health check |
| POST | `/api/orders/delivery` | Place a delivery order |
| POST | `/api/orders/takeaway` | Place a takeaway order |
| POST | `/api/bookings` | Book a table |
| POST | `/api/reviews` | Submit a review (rating 1–5) |
| GET | `/api/reviews` | Latest 20 reviews |
| POST | `/api/admin/login` | Admin login → bearer token |
| GET | `/api/admin/records?status=` | All orders + bookings (admin; filter: ALL / PLACED / UNDER_PROCESS / COMPLETED) |
| PATCH | `/api/admin/records/:type/:id/status` | Update status (`:type` = `order` or `booking`) |

Admin tokens are held in server memory — restarting the server logs admins out.

## Schema

`schema.sql` is applied idempotently every time the server starts, so a fresh clone only needs the empty `dinex_restaurant` database to exist.
