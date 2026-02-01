import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';

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
            
            // Default to 'misc' if project not found (shouldn't happen for valid tasks)
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

const upload = multer({ storage: storage });

// Get attachments for a task
router.get('/tasks/:taskId/attachments', (req, res) => {
    const { taskId } = req.params;
    try {
        const attachments = db.prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
        res.json(attachments);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Upload attachment
router.post('/tasks/:taskId/attachments', upload.single('file'), (req, res) => {
    const { taskId } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Fix Chinese filename encoding issue (Latin1 -> UTF8)
        // Multer often decodes non-ASCII filenames as Latin1
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

        const insert = db.prepare('INSERT INTO attachments (task_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)');
        const result = insert.run(taskId, originalName, file.filename, file.mimetype, file.size);
        
        const newAttachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newAttachment);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete attachment
router.delete('/attachments/:id', (req, res) => {
    const { id } = req.params;
    try {
        // Get file path before deleting record
        const attachment = db.prepare('SELECT file_path FROM attachments WHERE id = ?').get(id) as { file_path: string } | undefined;

        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        const stmt = db.prepare('DELETE FROM attachments WHERE id = ?');
        const result = stmt.run(id);
        
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
