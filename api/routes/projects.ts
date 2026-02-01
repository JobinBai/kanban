import express, { type Request } from 'express';
import db from '../db.js';
import { type AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all projects
router.get('/', (req: Request, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    const stmt = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY order_index ASC, created_at ASC');
    const rows = stmt.all(userId);
    res.json({
      success: true,
      data: rows
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Create project
router.post('/', (req: Request, res) => {
  const { name, description } = req.body;
  const userId = (req as AuthRequest).user?.id;
  
  if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
  }

  try {
    // Get max order_index
    const maxOrder = db.prepare('SELECT MAX(order_index) as max_order FROM projects WHERE user_id = ?').get(userId) as { max_order: number };
    const nextOrder = (maxOrder?.max_order ?? -1) + 1;

    const stmt = db.prepare('INSERT INTO projects (name, description, user_id, order_index) VALUES (?, ?, ?, ?)');
    const info = stmt.run(name, description || '', userId, nextOrder);
    
    // Auto-create default columns for new project
    const projectId = Number(info.lastInsertRowid);
    const insertCol = db.prepare('INSERT INTO columns (title, order_index, project_id) VALUES (?, ?, ?)');
    insertCol.run('待办', 0, projectId);
    insertCol.run('进行中', 1, projectId);
    insertCol.run('已完成', 2, projectId);

    res.json({
      success: true,
      data: {
        id: projectId,
        name,
        description,
        user_id: userId,
        order_index: nextOrder,
        created_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Reorder projects
router.put('/reorder', (req: Request, res) => {
    const { projectIds } = req.body;
    const userId = (req as AuthRequest).user?.id;

    if (!Array.isArray(projectIds)) {
        res.status(400).json({ success: false, error: 'projectIds must be an array' });
        return;
    }

    try {
        db.transaction(() => {
            const stmt = db.prepare('UPDATE projects SET order_index = ? WHERE id = ? AND user_id = ?');
            projectIds.forEach((id, index) => {
                stmt.run(index, id, userId);
            });
        })();

        res.json({ success: true, message: 'Projects reordered' });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Delete project
router.delete('/:id', (req: Request, res) => {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;

    try {
        // Ensure project belongs to user
        const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found or unauthorized' });
            return;
        }

        db.transaction(() => {
            const getCols = db.prepare('SELECT id FROM columns WHERE project_id = ?').all(id) as {id: number}[];
            const colIds = getCols.map(c => c.id);
            if (colIds.length > 0) {
                db.prepare(`DELETE FROM tasks WHERE column_id IN (${colIds.join(',')})`).run();
                db.prepare('DELETE FROM columns WHERE project_id = ?').run(id);
            }
            db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        })();

        res.json({
            success: true,
            message: 'Project deleted'
        });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Update project
router.put('/:id', (req: Request, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const userId = (req as AuthRequest).user?.id;

    if (!name) {
        res.status(400).json({ success: false, error: 'Name is required' });
        return;
    }

    try {
        // Ensure project belongs to user
        const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found or unauthorized' });
            return;
        }

        const stmt = db.prepare('UPDATE projects SET name = ? WHERE id = ?');
        const info = stmt.run(name, id);

        res.json({
            success: true,
            message: 'Project updated',
            changes: info.changes
        });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

export default router;
