import express from 'express';
import db from '../db.js';

const router = express.Router();

// Get all tasks (optionally filtered by project_id, but usually we fetch by column logic or all and filter in frontend, 
// BUT better to fetch by project. 
// However, current simple implementation fetches ALL tasks. 
// Let's support filtering by project_id via join if needed, or just fetch all and frontend filters.
// Actually, with multi-project, we should filter by project_id to avoid loading all data.
// But `tasks` table only has `column_id`. So we need to join columns.
router.get('/', (req, res) => {
  const { project_id } = req.query;

  try {
    let query = 'SELECT tasks.*, (SELECT COUNT(*) FROM attachments WHERE attachments.task_id = tasks.id) as attachment_count FROM tasks';
    const params = [];

    if (project_id) {
        query += ' JOIN columns ON tasks.column_id = columns.id WHERE columns.project_id = ?';
        params.push(project_id);
    }

    query += ' ORDER BY tasks.order_index ASC, tasks.created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    res.json({
      success: true,
      data: rows
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Create task
router.post('/', (req, res) => {
  const { title, description, column_id, priority = 3 } = req.body;
  
  if (!title || !column_id) {
      res.status(400).json({ success: false, error: 'Title and column_id are required' });
      return;
  }

  try {
    // Get max order_index for new task in this column
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE column_id = ?');
    const { count } = countStmt.get(column_id) as { count: number };

    const stmt = db.prepare('INSERT INTO tasks (title, description, column_id, priority, order_index) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(title, description || '', column_id, priority, count); // append to end
    
    res.json({
      success: true,
      data: {
        id: Number(info.lastInsertRowid),
        title,
        description: description || '',
        column_id,
        priority,
        order_index: count,
        created_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update task
router.put('/:id', (req, res) => {
  const { title, description, column_id, priority, order_index } = req.body;
  const { id } = req.params;
  
  try {
    const updates = [];
    const values = [];

    if (title !== undefined) {
        updates.push('title = ?');
        values.push(title);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }
    if (column_id !== undefined) {
        updates.push('column_id = ?');
        values.push(column_id);
    }
    if (priority !== undefined) {
        updates.push('priority = ?');
        values.push(priority);
    }
    if (order_index !== undefined) {
        updates.push('order_index = ?');
        values.push(order_index);
    }

    if (updates.length === 0) {
        res.status(400).json({ success: false, error: 'No updates provided' });
        return;
    }

    values.push(id);

    const stmt = db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`);
    const info = stmt.run(...values);
    
    res.json({
        success: true,
        message: 'Task updated',
        changes: info.changes
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Batch update for reordering (optional but good for performance)
router.post('/reorder', (req, res) => {
    const { items } = req.body; // Array of { id, order_index, column_id }
    
    if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'Items array is required' });
        return;
    }

    try {
        const updateStmt = db.prepare('UPDATE tasks SET order_index = ?, column_id = ? WHERE id = ?');
        const transaction = db.transaction((tasks) => {
            for (const task of tasks) {
                updateStmt.run(task.order_index, task.column_id, task.id);
            }
        });
        
        transaction(items);
        
        res.json({ success: true, message: 'Tasks reordered' });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Delete task
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    const info = stmt.run(id);
    
    res.json({
        success: true,
        message: 'Task deleted',
        changes: info.changes
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
