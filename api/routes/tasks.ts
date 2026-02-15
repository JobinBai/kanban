import express, { type Request } from 'express';
import db from '../db.js';
import { type AuthRequest } from '../middleware/auth.js';
import { checkProjectAccess, checkColumnAccess, checkTaskAccess } from '../utils/permissions.js';

const router = express.Router();

// Get all tasks (optionally filtered by project_id)
router.get('/', (req: Request, res) => {
  const { project_id } = req.query;
  const userId = (req as AuthRequest).user?.id;

  try {
    let query = 'SELECT tasks.*, (SELECT COUNT(*) FROM attachments WHERE attachments.task_id = tasks.id) as attachment_count FROM tasks';
    const params: any[] = [];

    // Force filtering by user's projects via join
    query += ' JOIN columns ON tasks.column_id = columns.id JOIN projects ON columns.project_id = projects.id WHERE projects.user_id = ?';
    params.push(userId);

    if (project_id) {
        // Double check if this project belongs to user
        if (!checkProjectAccess(userId!, Number(project_id))) {
             res.status(403).json({ success: false, error: 'Unauthorized access to project' });
             return;
        }
        query += ' AND columns.project_id = ?';
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
router.post('/', (req: Request, res) => {
  const { title, description, column_id, priority = 3 } = req.body;
  const userId = (req as AuthRequest).user?.id;
  
  if (!title || !column_id) {
      res.status(400).json({ success: false, error: 'Title and column_id are required' });
      return;
  }

  // Check column access
  if (!checkColumnAccess(userId!, Number(column_id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to column' });
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
router.put('/:id', (req: Request, res) => {
  const { title, description, column_id, priority, order_index } = req.body;
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  // Check task access
  if (!checkTaskAccess(userId!, Number(id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to task' });
      return;
  }

  // If moving to another column, check target column access
  if (column_id !== undefined && !checkColumnAccess(userId!, Number(column_id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to target column' });
      return;
  }
  
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

// Batch update for reordering
router.post('/reorder', (req: Request, res) => {
    const { items } = req.body; // Array of { id, order_index, column_id }
    const userId = (req as AuthRequest).user?.id;
    
    if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'Items array is required' });
        return;
    }

    try {
        const updateStmt = db.prepare('UPDATE tasks SET order_index = ?, column_id = ? WHERE id = ?');
        
        const transaction = db.transaction((tasks) => {
            for (const task of tasks) {
                // Check task ownership
                if (!checkTaskAccess(userId!, task.id)) {
                    throw new Error(`Unauthorized access to task ${task.id}`);
                }
                // Check target column ownership
                if (!checkColumnAccess(userId!, task.column_id)) {
                    throw new Error(`Unauthorized access to column ${task.column_id}`);
                }

                updateStmt.run(task.order_index, task.column_id, task.id);
            }
        });
        
        transaction(items);
        
        res.json({ success: true, message: 'Tasks reordered' });
    } catch (err: any) {
        // If one fails, transaction rolls back
        res.status(400).json({ success: false, error: err.message });
    }
});

// Delete task
router.delete('/:id', (req: Request, res) => {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  if (!checkTaskAccess(userId!, Number(id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to task' });
      return;
  }

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
