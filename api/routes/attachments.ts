import express, { type Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';
import { type AuthRequest } from '../middleware/auth.js';
import { checkTaskAccess } from '../utils/permissions.js';

const router = express.Router();

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads/';
        const { taskId } = req.params;

        try {
            // Find project_id for this task
            // tasks -> columns -> project_id
            const stmt = db.prepare(`
                SELECT c.project_id 
                FROM tasks t 
                JOIN columns c ON t.column_id = c.id 
                WHERE t.id = ?
            `);
            const result = stmt.get(taskId) as { project_id: number } | undefined;
            
            // Default to 'misc' if project not found
            const projectId = result ? result.project_id : 'misc';
            
            // Create project directory
            const projectDir = path.join(uploadDir, String(projectId));
            if (!fs.existsSync(projectDir)) {
                fs.mkdirSync(projectDir, { recursive: true });
            }

            // Attach projectId to req for use in route handler
            (req as any).targetProjectId = projectId;

            cb(null, projectDir);
        } catch (err) {
            console.error('Error determining upload directory:', err);
            // Fallback to root upload dir
            cb(null, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        // Use a clean filename to avoid filesystem issues, but preserve extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed types: Images, PDF, Text, Word docs'), false);
        }
    }
});

// Get attachments for a task
router.get('/tasks/:taskId/attachments', (req: Request, res) => {
    const { taskId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!checkTaskAccess(userId!, Number(taskId))) {
        res.status(403).json({ error: 'Unauthorized access to task' });
        return;
    }

    try {
        const attachments = db.prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
        res.json(attachments);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Upload attachment
router.post('/tasks/:taskId/attachments', upload.single('file'), (req: Request, res) => {
    const { taskId } = req.params;
    const file = req.file;
    const userId = (req as AuthRequest).user?.id;

    if (!checkTaskAccess(userId!, Number(taskId))) {
        // Delete the uploaded file if verification fails
        if (file) {
            try {
                fs.unlinkSync(file.path);
            } catch (e) {
                console.error('Failed to delete unauthorized upload:', e);
            }
        }
        res.status(403).json({ error: 'Unauthorized access to task' });
        return;
    }

    if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    try {
        // Fix Chinese filename encoding issue (Latin1 -> UTF8)
        // Multer often decodes non-ASCII filenames as Latin1
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

        // Store relative path so we can delete it later correctly
        const projectId = (req as any).targetProjectId || 'misc';
        const relativePath = path.join(String(projectId), file.filename);

        const insert = db.prepare('INSERT INTO attachments (task_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)');
        const result = insert.run(taskId, originalName, relativePath, file.mimetype, file.size);
        
        const newAttachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newAttachment);
    } catch (error) {
        // Clean up file on error
        if (file) {
            try {
                 fs.unlinkSync(file.path);
            } catch (cleanupError) {
                console.error('Failed to cleanup file:', cleanupError);
            }
        }
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete attachment
router.delete('/attachments/:id', (req: Request, res) => {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;

    try {
        // Get file path and task info before deleting record
        const stmt = db.prepare(`
            SELECT a.file_path, t.id as task_id
            FROM attachments a
            JOIN tasks t ON a.task_id = t.id
            WHERE a.id = ?
        `);
        const attachment = stmt.get(id) as { file_path: string, task_id: number } | undefined;

        if (!attachment) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }

        if (!checkTaskAccess(userId!, attachment.task_id)) {
            res.status(403).json({ error: 'Unauthorized access to attachment' });
            return;
        }

        const deleteStmt = db.prepare('DELETE FROM attachments WHERE id = ?');
        const result = deleteStmt.run(id);
        
        if (result.changes > 0) {
            // Delete file from filesystem
            const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
            const filePath = path.join(uploadDir, attachment.file_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        res.json({ message: 'Attachment deleted' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
