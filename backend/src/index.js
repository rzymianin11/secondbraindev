import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';
import decisionsRouter from './routes/decisions.js';
import recordingsRouter from './routes/recordings.js';
import tasksRouter from './routes/tasks.js';
import tagsRouter from './routes/tags.js';
import relationsRouter from './routes/relations.js';
import searchRouter from './routes/search.js';
import { isOpenAIConfigured } from './services/openai.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/recordings', recordingsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/relations', relationsRouter);
app.use('/api/search', searchRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    openai: isOpenAIConfigured() ? 'configured' : 'not configured'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Second Brain API running on http://localhost:${PORT}`);
});
