import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase external connections
});

// --- Schema Initialization ---
const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        text TEXT DEFAULT '',
        section_id TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        task_order INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
      CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(date, section_id);

      CREATE TABLE IF NOT EXISTS section_meta (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        section_id TEXT NOT NULL,
        min_hours TEXT DEFAULT '',
        max_hours TEXT DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_section_meta_date ON section_meta(date);

      CREATE TABLE IF NOT EXISTS reflections (
        date TEXT PRIMARY KEY,
        text TEXT DEFAULT ''
      );
    `);
    console.log('✅ PostgreSQL Schema Initialized');
  } catch (err) {
    console.error('Error initializing schema:', err);
  } finally {
    client.release();
  }
};

initDb();

// --- Query Functions ---
const queries = {
  // Tasks
  getTasksByDate: async (date) => {
    const res = await pool.query('SELECT * FROM tasks WHERE date = $1 ORDER BY section_id, task_order', [date]);
    return res.rows;
  },
  
  getAllTasksSummary: async () => {
    const res = await pool.query(`
      SELECT date, 
             COUNT(*) as total, 
             SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed 
      FROM tasks 
      GROUP BY date
    `);
    return res.rows;
  },
  
  insertTask: async (task) => {
    await pool.query(`
      INSERT INTO tasks (id, date, text, section_id, completed, task_order) 
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [task.id, task.date, task.text, task.sectionId, task.completed, task.order]);
  },
  
  updateTask: async (task) => {
    const res = await pool.query(`
      UPDATE tasks SET text = $1, section_id = $2, completed = $3, task_order = $4, date = $5
      WHERE id = $6
    `, [task.text, task.sectionId, task.completed, task.order, task.date, task.id]);
    return res.rowCount;
  },
  
  deleteTask: async (id) => {
    const res = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return res.rowCount;
  },
  
  // Section Meta
  getSectionMetaByDate: async (date) => {
    const res = await pool.query('SELECT * FROM section_meta WHERE date = $1', [date]);
    return res.rows;
  },
  
  upsertSectionMeta: async (meta) => {
    await pool.query(`
      INSERT INTO section_meta (id, date, section_id, min_hours, max_hours) 
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(id) DO UPDATE SET min_hours = $4, max_hours = $5
    `, [meta.id, meta.date, meta.sectionId, meta.minHours, meta.maxHours]);
  },
  
  // Reflections
  getReflection: async (date) => {
    const res = await pool.query('SELECT * FROM reflections WHERE date = $1', [date]);
    return res.rows[0];
  },
  
  upsertReflection: async (data) => {
    await pool.query(`
      INSERT INTO reflections (date, text) VALUES ($1, $2)
      ON CONFLICT(date) DO UPDATE SET text = $2
    `, [data.date, data.text]);
  },

  // Batch
  batchUpdateTasks: async (tasks) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const t of tasks) {
        await client.query(`
          UPDATE tasks SET text = $1, section_id = $2, completed = $3, task_order = $4, date = $5
          WHERE id = $6
        `, [t.text, t.sectionId, t.completed, t.order, t.date, t.id]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};

export { pool, queries };
