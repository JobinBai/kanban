import express, { type Request } from 'express';
import db from '../db.js';
import { type AuthRequest } from '../middleware/auth.js';
import { checkProjectAccess, checkColumnAccess } from '../utils/permissions.js';

const router = express.Router();

// Get columns for a project
router.get('/', (req: Request, res) => {
  const { project_id } = req.query;
  const userId = (req as AuthRequest).user?.id;
  
  if (!project_id) {
      res.status(400).json({ success: false, error: 'project_id is required' });
      return;
  }

  if (!checkProjectAccess(userId!, Number(project_id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to project' });
      return;
  }

  try {
    const stmt = db.prepare('SELECT * FROM columns WHERE project_id = ? ORDER BY order_index');
    const rows = stmt.all(project_id);
    res.json({
      success: true,
      data: rows
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Create column
router.post('/', (req: Request, res) => {
  const { title, project_id, color = '#f59e0b' } = req.body;
  const userId = (req as AuthRequest).user?.id;
  
  if (!title || !project_id) {
      res.status(400).json({ success: false, error: 'Title and project_id are required' });
      return;
  }

  if (!checkProjectAccess(userId!, Number(project_id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to project' });
      return;
  }

  try {
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM columns WHERE project_id = ?');
    const { count } = countStmt.get(project_id) as { count: number };

    const stmt = db.prepare('INSERT INTO columns (title, order_index, project_id, color) VALUES (?, ?, ?, ?)');
    const info = stmt.run(title, count, project_id, color);
    
    res.json({
      success: true,
      data: {
        id: Number(info.lastInsertRowid),
        title,
        order_index: count,
        project_id,
        color
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update column (title/color)
router.put('/:id', (req: Request, res) => {
  const { title, color } = req.body;
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;
  
  if (!checkColumnAccess(userId!, Number(id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to column' });
      return;
  }

  if (!title && !color) {
      res.status(400).json({ success: false, error: 'Title or color is required' });
      return;
  }

  try {
    const updates = [];
    const values = [];

    if (title) {
        updates.push('title = ?');
        values.push(title);
    }
    if (color) {
        updates.push('color = ?');
        values.push(color);
    }
    
    values.push(id);

    const stmt = db.prepare(`UPDATE columns SET ${updates.join(', ')} WHERE id = ?`);
    const info = stmt.run(...values);
    
    res.json({
        success: true,
        message: 'Column updated',
        changes: info.changes
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Batch update for reordering
router.post('/reorder', (req: Request, res) => {
    const { items } = req.body; // Array of { id, order_index }
    const userId = (req as AuthRequest).user?.id;
    
    if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'Items array is required' });
        return;
    }

    try {
        const updateStmt = db.prepare('UPDATE columns SET order_index = ? WHERE id = ?');
        const transaction = db.transaction((columns) => {
            for (const col of columns) {
                if (!checkColumnAccess(userId!, col.id)) {
                    throw new Error(`Unauthorized access to column ${col.id}`);
                }
                updateStmt.run(col.order_index, col.id);
            }
        });
        
        transaction(items);
        
        res.json({ success: true, message: 'Columns reordered' });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Delete column
router.delete('/:id', (req: Request, res) => {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  if (!checkColumnAccess(userId!, Number(id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to column' });
      return;
  }

  try {
    // Transaction to delete tasks and column
    const deleteTasks = db.prepare('DELETE FROM tasks WHERE column_id = ?');
    const deleteColumn = db.prepare('DELETE FROM columns WHERE id = ?');
    
    db.transaction(() => {
        deleteTasks.run(id);
        deleteColumn.run(id);
    })();
    
    res.json({
        success: true,
        message: 'Column deleted'
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
