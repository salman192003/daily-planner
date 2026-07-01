import express from 'express';
import cors from 'cors';
import { pool, queries } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.DATABASE_URL) {
  console.error('❌ CRITICAL ERROR: DATABASE_URL is not set in environment variables.');
  console.error('If you are on Vercel, add DATABASE_URL in the project settings -> Environment Variables.');
}

app.use(cors());
app.use(express.json());

// ============================================================
// TASKS
// ============================================================

// GET /api/tasks?date=YYYY-MM-DD
app.get('/api/tasks', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required' });
  
  try {
    const rows = await queries.getTasksByDate(date);
    const tasks = rows.map(r => ({
      id: r.id,
      date: r.date,
      text: r.text,
      sectionId: r.section_id,
      completed: r.completed === 1,
      order: r.task_order
    }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/summary
app.get('/api/tasks/summary', async (_req, res) => {
  try {
    const rows = await queries.getAllTasksSummary();
    const summary = {};
    for (const r of rows) {
      summary[r.date] = { 
        total: parseInt(r.total, 10), 
        completed: parseInt(r.completed, 10) 
      };
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
app.post('/api/tasks', async (req, res) => {
  const { id, date, text, sectionId, completed, order } = req.body;
  try {
    await queries.insertTask({ id, date, text, sectionId, completed: completed ? 1 : 0, order });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { date, text, sectionId, completed, order } = req.body;
  try {
    const changes = await queries.updateTask({ id, date, text, sectionId, completed: completed ? 1 : 0, order });
    if (changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/batch
app.put('/api/tasks/batch', async (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array required' });
  
  try {
    const mappedTasks = tasks.map(t => ({
      id: t.id,
      date: t.date,
      text: t.text,
      sectionId: t.sectionId,
      completed: t.completed ? 1 : 0,
      order: t.order
    }));
    await queries.batchUpdateTasks(mappedTasks);
    res.json({ updated: tasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const changes = await queries.deleteTask(id);
    if (changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ deleted: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SECTION META
// ============================================================

// GET /api/section-meta?date=YYYY-MM-DD
app.get('/api/section-meta', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required' });
  
  try {
    const rows = await queries.getSectionMetaByDate(date);
    const meta = {};
    for (const r of rows) {
      meta[r.id] = { min: r.min_hours, max: r.max_hours };
    }
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/section-meta
app.put('/api/section-meta', async (req, res) => {
  const { date, sectionId, min, max } = req.body;
  const id = `${date}-${sectionId}`;
  try {
    await queries.upsertSectionMeta({ id, date, sectionId, minHours: min || '', maxHours: max || '' });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REFLECTIONS
// ============================================================

// GET /api/reflections/:date
app.get('/api/reflections/:date', async (req, res) => {
  const { date } = req.params;
  try {
    const row = await queries.getReflection(date);
    res.json({ text: row?.text || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reflections/:date
app.put('/api/reflections/:date', async (req, res) => {
  const { date } = req.params;
  const { text } = req.body;
  try {
    await queries.upsertReflection({ date, text: text || '' });
    res.json({ date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// START SERVER
// ============================================================
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n  🐘  Planner API running → http://localhost:${PORT}`);
    console.log(`  🔗 Database: Supabase PostgreSQL\n`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end();
  process.exit(0);
});
process.on('SIGTERM', () => {
  pool.end();
  process.exit(0);
});

export default app;
