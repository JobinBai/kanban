import db from '../db.js';

export const checkProjectAccess = (userId: number, projectId: number): boolean => {
    const row = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
    return !!row;
};

export const checkColumnAccess = (userId: number, columnId: number): boolean => {
    const row = db.prepare(`
        SELECT p.id 
        FROM projects p 
        JOIN columns c ON c.project_id = p.id 
        WHERE c.id = ? AND p.user_id = ?
    `).get(columnId, userId);
    return !!row;
};

export const checkTaskAccess = (userId: number, taskId: number): boolean => {
    const row = db.prepare(`
        SELECT p.id 
        FROM projects p 
        JOIN columns c ON c.project_id = p.id 
        JOIN tasks t ON t.column_id = c.id
        WHERE t.id = ? AND p.user_id = ?
    `).get(taskId, userId);
    return !!row;
};
