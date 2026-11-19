# Emotionally Charged Review Detection and Mitigation System for Retail & E-Commerce

A full-stack DBMS capstone project for managing, analyzing, and responding to emotionally charged customer reviews in retail and e-commerce environments.

The project combines a web-based administration interface with a MySQL database and RESTful Node.js API. It is designed to help moderators identify high-risk or emotionally charged feedback, prioritize responses, track mitigation actions, and preserve structured audit records. This repository currently provides the library-management database foundation and web application as the capstone implementation base.

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [System Goals](#system-goals)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Database Setup](#database-setup)
- [Installation and Running the Project](#installation-and-running-the-project)
- [Environment Variables](#environment-variables)
- [Available Routes](#available-routes)
- [Database and Transaction Design](#database-and-transaction-design)
- [Security Considerations](#security-considerations)
- [Testing and Validation](#testing-and-validation)
- [Potential Enhancements](#potential-enhancements)
- [Troubleshooting](#troubleshooting)

## Project Overview

Emotionally charged reviews can contain anger, frustration, urgency, threats, hate speech, or highly positive enthusiasm. A manual moderation process may overlook important negative feedback or respond inconsistently.

This system provides a structured platform for collecting review data and helping a team:

- classify customer feedback according to emotional intensity;
- distinguish urgent complaints from routine feedback;
- assign or escalate reviews for moderation;
- record mitigation actions and outcomes;
- identify repeated issues across products and customers;
- generate operational reports and dashboard summaries.

The existing application demonstrates the supporting database-driven workflow using a library-style dataset. Entities, relationships, transactions, constraints, reporting views, and CRUD operations provide reusable patterns for a retail review platform.

## Key Features

- Dashboard with summary counts and recent activity
- Generic Create, Read, Update, and Delete operations
- Entity relationships and detail views
- Search and filtering for records
- Transactional issue and return workflows
- Fine calculation and payment-status management
- Database reports, views, and aggregate summaries
- Parameterized SQL queries and server-side input validation
- Role-based MySQL database account support
- Responsive, framework-free browser interface

### Intended Review Moderation Features

The following features define the target retail/e-commerce review use case:

- Emotion and sentiment classification
- Emotional-intensity and urgency scoring
- Review categorization by complaint type
- Priority queues for moderators
- Escalation and mitigation status tracking
- Product and category-level issue reporting
- Customer-safe response templates
- Audit trails for every moderation decision

Emotion-detection and moderation models are not yet implemented in the current repository.

## System Goals

1. Improve review triage speed and consistency.
2. Surface potentially harmful or high-risk feedback.
3. Support fair, transparent moderator decisions.
4. Preserve an auditable record of review and mitigation actions.
5. Reduce the operational impact of abusive or emotionally charged reviews.
6. Present actionable insights to store owners and customer-support teams.

## Technology Stack

### Backend

- Node.js 18 or newer
- Express.js
- `mysql2` for MySQL connections and parameterized queries
- `dotenv` for environment configuration

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Fetch API

### Database

- MySQL 8.x
- InnoDB tables
- Foreign keys and check constraints
- Views and aggregate report queries
- Transactions with row locking

### Development Tools

- npm
- Node.js watch mode
- MySQL command-line client
- Git

## Architecture

```text
Browser
   |
   | HTTP / JSON
   v
Express API Server
   |
   | mysql2 connection pool
   v
MySQL Database
```

The Express server provides static frontend assets and REST endpoints. API routes are separated by concern:

- Generic entity CRUD
- Specialized detail and workflow routes
- Reports
- Administrative and database-operation routes

Database writes that require multiple related changes use transaction helpers. Financial and circulation calculations are performed through MySQL queries and validated in the application layer.

## Directory Structure

```text
library-app/
|-- backend/
|   |-- routes/
|   |   |-- admin.js          # Administrative and database-operation endpoints
|   |   |-- crud.js           # Generic entity CRUD routes
|   |   |-- reports.js        # Reporting queries
|   |   `-- special.js        # Details, circulation, fines, and dashboard
|   |-- db.js                 # MySQL pool and transaction helper
|   |-- errors.js             # HTTP and MySQL error translation
|   |-- meta.js               # Entity fields, validation, and list definitions
|   `-- server.js             # Express app and API registration
|-- frontend/
|   |-- css/
|   |   `-- style.css         # Application styles
|   |-- js/
|   |   `-- app.js            # Frontend navigation and API interactions
|   `-- index.html            # Single-page application shell
|-- .env                      # Local configuration (not committed)
|-- .env.example              # Example environment configuration
|-- .gitignore
|-- package.json              # npm scripts and dependencies
|-- package-lock.json
|-- seed.sql                  # Database schema, seed data, roles, and views
`-- README.md
```

## Database Setup

### Prerequisites

Install:

- Node.js 18 or later
- npm, included with Node.js
- MySQL 8.0 or later
- A MySQL user with permission to create the database

Verify the installations:

```bash
node --version
npm --version
mysql --version
```

### Create the Database

Run the seed script from the project root:

**Windows PowerShell or Command Prompt**

```bat
mysql -u root -p < seed.sql
```

**macOS or Linux**

```bash
mysql -u root -p < seed.sql
```

The seed script creates the `library_db` database and its schema, test data, views, constraints, and application database users. It should be run once during initial setup.

To reset the database during development, rerun the same command. This is destructive because the seed script begins by dropping `library_db`.

## Installation and Running the Project

### 1. Clone or download the repository

```bash
git clone <repository-url>
cd library-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

Create a local environment file:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**macOS or Linux**

```bash
cp .env.example .env
```

Edit `.env` to match the MySQL server and account used in your environment.

### 4. Initialize MySQL

Use the database setup command shown above.

### 5. Start the application

Development mode with automatic server restart:

```bash
npm run dev
```

Normal start mode:

```bash
npm start
```

Open <http://localhost:3000> in a browser.

Verify the database connection and API health:

```text
http://localhost:3000/api/health
```

## Environment Variables

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | HTTP port for Express | `3000` |
| `DB_HOST` | MySQL server hostname | `localhost` |
| `DB_PORT` | MySQL server port | `3306` |
| `DB_USER` | MySQL application account | `lib_admin` |
| `DB_PASSWORD` | MySQL account password | Set locally |
| `DB_NAME` | Database name | `library_db` |

Never commit the real `.env` file or database credentials.

## Available Routes

Examples of the primary API route groups:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check API and database availability |
| `GET` | `/api/dashboard` | Retrieve dashboard summaries |
| `GET` | `/api/:entity` | List an entity |
| `POST` | `/api/:entity` | Create an entity |
| `PUT` | `/api/:entity/:id` | Update an entity |
| `DELETE` | `/api/:entity/:id` | Delete an entity |
| `POST` | `/api/loans/issue` | Issue a physical item |
| `POST` | `/api/loans/:id/return` | Return an issued item |
| `GET` | `/api/reports/*` | Retrieve reports and aggregates |
| `GET` | `/api/admin/*` | Run supported administrative operations |

The frontend calls these endpoints through `/api` using the Fetch API.

## Database and Transaction Design

The schema uses primary keys, foreign keys, enum constraints, unique values, check constraints, and views where appropriate.

Important transaction behavior includes:

- Issue and return operations run inside database transactions.
- Related rows are locked with `SELECT ... FOR UPDATE`.
- Eligibility and availability are validated before a loan is created.
- Returning an item is prevented if it has already been returned.
- A fine is created only for a late return.
- `fines.loan_id` is unique, preventing duplicate fines for one loan.
- Database operations use parameterized values rather than string-built SQL.

For a future review-mitigation system, corresponding tables could include:

- `customers`
- `products`
- `reviews`
- `emotion_scores`
- `moderation_actions`
- `moderators`
- `escalations`
- `mitigation_statuses`
- `audit_logs`

## Security Considerations

- SQL values are passed as parameters through `mysql2`.
- Table and entity names are restricted by server-side definitions.
- No raw SQL endpoint is exposed.
- `.env` is excluded from version control.
- The database should use a least-privilege application account.
- User-facing errors are translated rather than exposing internal database details.
- Review moderation actions should retain moderator identity and timestamps.
- Production deployments should enforce HTTPS and stronger authentication.

## Testing and Validation

There is no automated test runner in the current package scripts. Before submission or deployment, manually verify:

1. Database initialization completes without SQL errors.
2. `/api/health` returns a successful response.
3. The dashboard loads sample data.
4. Search and filters return the expected records.
5. Create, update, and delete operations work.
6. An issue transaction rejects an inactive member or unavailable copy.
7. A late return creates one fine.
8. An already-returned item cannot be returned twice.
9. Invalid API input produces a clear JSON error.

Example health check:

```bash
curl http://localhost:3000/api/health
```

## Potential Enhancements

- Integrate NLP-based emotion and sentiment classification.
- Add a moderation queue and confidence scores.
- Use a topic model to identify repeated product issues.
- Add severity and escalation levels.
- Support moderator assignment and SLA tracking.
- Generate email or in-app responses to customers.
- Add authentication and role-based authorization.
- Add automated API and database tests.
- Implement pagination and server-side sorting at scale.
- Add audit logging and exportable moderation reports.
- Deploy behind a reverse proxy with HTTPS.

## Troubleshooting

### Cannot connect to MySQL

- Confirm MySQL is running.
- Check `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD`.
- Confirm `lib_admin` was created by `seed.sql`.
- Verify the database exists by running `USE library_db;`.

### Port 3000 is already in use

Change `PORT` in `.env`, for example:

```env
PORT=3001
```

Then open `http://localhost:3001`.

### Database changes are not visible

The seed script resets all existing data. After rerunning it, refresh the browser and restart the application.

### `mysql < seed.sql` fails on Windows

Make sure MySQL's `bin` directory is in `PATH`, or run the command using the full MySQL executable path.
