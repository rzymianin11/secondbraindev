# Second Brain for Devs

A structured memory system for tracking technical decisions made during software projects.

**This is not a note-taking app.** It is a timeline of decisions—each with intent, context, and consequences.

## Quick Start

### Prerequisites
- Node.js 18+

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the App

In two separate terminals:

```bash
# Terminal 1: Start the backend (port 3001)
cd backend
npm run dev

# Terminal 2: Start the frontend (port 3000)
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
braindev/
├── backend/           # Express + SQLite API
│   ├── src/
│   │   ├── index.js   # Server entry point
│   │   ├── db.js      # Database setup & schema
│   │   └── routes/    # API routes
│   └── data/          # SQLite database (auto-created)
├── frontend/          # React 19 + Vite
│   └── src/
│       ├── components/  # UI components
│       └── api.js       # API client
└── README.md
```

## Data Model

### Project
| Field       | Type    | Description           |
|-------------|---------|----------------------|
| id          | INTEGER | Primary key          |
| name        | TEXT    | Project name         |
| description | TEXT    | Optional description |
| createdAt   | TEXT    | ISO timestamp        |

### Decision
| Field        | Type    | Description                    |
|--------------|---------|--------------------------------|
| id           | INTEGER | Primary key                    |
| projectId    | INTEGER | Foreign key to project         |
| title        | TEXT    | Decision title                 |
| description  | TEXT    | What was decided               |
| reason       | TEXT    | Why this decision was made     |
| consequences | TEXT    | Known trade-offs               |
| createdAt    | TEXT    | ISO timestamp                  |

### Link
| Field      | Type    | Description                              |
|------------|---------|------------------------------------------|
| id         | INTEGER | Primary key                              |
| decisionId | INTEGER | Foreign key to decision                  |
| type       | TEXT    | commit, pr, task, file, or note          |
| reference  | TEXT    | URL, commit hash, or text reference      |

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project
- `DELETE /api/projects/:id` - Delete project

### Decisions
- `GET /api/decisions/project/:projectId` - List decisions by project
- `GET /api/decisions/:id` - Get decision with links
- `POST /api/decisions` - Create decision (with optional links)
- `DELETE /api/decisions/:id` - Delete decision

### Links
- `POST /api/decisions/:id/links` - Add link to decision
- `DELETE /api/decisions/links/:linkId` - Delete link

## Tech Stack
- **Frontend**: React 19, React Router 7, Vite
- **Backend**: Express 4, better-sqlite3
- **Database**: SQLite
- **Styling**: Custom CSS (minimal, neutral)

## License
MIT
