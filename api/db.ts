import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the database file is stored in a writable location
// Using process.cwd() is generally safer when running from root via scripts
const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'kanban.db');

console.log('Database path:', dbPath);

const db = new Database(dbPath);
console.log('Connected to the SQLite database.');

// Initialize Tables
const initDb = () => {
    // Users Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Seed Default User if empty (for migration purposes)
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    let defaultUserId = 1;
    if (usersCount.count === 0) {
        // Create a default admin user: admin / admin123
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin123', salt);
        const insertUser = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
        const info = insertUser.run('admin', hash);
        defaultUserId = Number(info.lastInsertRowid);
        console.log('Seeded default user (admin/admin123).');
    } else {
         const firstUser = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get() as { id: number };
         defaultUserId = firstUser.id;
    }

    // Projects Table
    let projectsInfo = [];
    try {
        projectsInfo = db.prepare('PRAGMA table_info(projects)').all() as any[];
    } catch (e) {}

    const hasUserId = projectsInfo.some(col => col.name === 'user_id');
    const hasOrderIndex = projectsInfo.some(col => col.name === 'order_index');

    if ((!hasUserId || !hasOrderIndex) && projectsInfo.length > 0) {
        console.log('Migrating projects table...');
        db.pragma('foreign_keys = OFF');
        const oldProjects = db.prepare('SELECT * FROM projects').all() as any[];
        db.exec('DROP TABLE projects');
        db.exec(`
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                user_id INTEGER NOT NULL DEFAULT ${defaultUserId},
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        const insertProject = db.prepare('INSERT INTO projects (id, name, description, user_id, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        for (const proj of oldProjects) {
            // Use existing order_index if available, else use id (preserves creation order roughly) or 0
            const orderIdx = proj.order_index !== undefined ? proj.order_index : proj.id;
            const userId = proj.user_id !== undefined ? proj.user_id : defaultUserId;
            insertProject.run(proj.id, proj.name, proj.description, userId, orderIdx, proj.created_at);
        }
        db.pragma('foreign_keys = ON');
    } else {
        db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                user_id INTEGER NOT NULL DEFAULT ${defaultUserId},
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    }

    // Check if projects are empty, if so seed default project
    const projectsCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    let defaultProjectId = 1;
    if (projectsCount.count === 0) {
        const insertProject = db.prepare('INSERT INTO projects (name, description, user_id, order_index) VALUES (?, ?, ?, ?)');
        const info = insertProject.run('默认项目', '这是您的第一个看板项目', defaultUserId, 0);
        defaultProjectId = Number(info.lastInsertRowid);
        console.log('Seeded default project.');
    } else {
        const firstProject = db.prepare('SELECT id FROM projects ORDER BY id LIMIT 1').get() as { id: number };
        defaultProjectId = firstProject.id;
    }

    // Check Columns Table Schema
    let columnsInfo = [];
    try {
        columnsInfo = db.prepare('PRAGMA table_info(columns)').all() as any[];
    } catch (e) {}

    const hasProjectId = columnsInfo.some(col => col.name === 'project_id');
    const hasColor = columnsInfo.some(col => col.name === 'color');

    if (!hasProjectId || !hasColor) {
        console.log('Migrating columns table (adding project_id and/or color)...');
        db.pragma('foreign_keys = OFF'); // Disable FKs to allow dropping referenced table
        const oldColumns = db.prepare('SELECT * FROM columns').all() as any[];
        db.exec('DROP TABLE columns');
        db.exec(`
            CREATE TABLE columns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                project_id INTEGER NOT NULL DEFAULT ${defaultProjectId},
                color TEXT DEFAULT '#f59e0b',
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);
        const insertCol = db.prepare('INSERT INTO columns (id, title, order_index, project_id, color) VALUES (?, ?, ?, ?, ?)');
        for (const col of oldColumns) {
            const color = col.color || '#f59e0b';
            insertCol.run(col.id, col.title, col.order_index, defaultProjectId, color);
        }
        db.pragma('foreign_keys = ON');
    } else {
        // Ensure table exists if fresh start (though drop/create handled it above, this handles "exists but correct")
        // But wait, the CREATE TABLE IF NOT EXISTS in previous code block was simplistic.
        // Let's just ensure it exists with correct schema if it doesn't.
        // Actually, if !hasProjectId, we dropped it. If it has it, we assume it's fine.
    }

    // Ensure columns table exists if it was somehow missing (e.g. fresh db)
    db.exec(`
        CREATE TABLE IF NOT EXISTS columns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            project_id INTEGER NOT NULL DEFAULT ${defaultProjectId},
            color TEXT DEFAULT '#f59e0b',
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);


    // Tasks Table
    let tableInfo = [];
    try {
        tableInfo = db.prepare('PRAGMA table_info(tasks)').all() as any[];
    } catch (e) {}

    const hasTaskOrderIndex = tableInfo.some(col => col.name === 'order_index');

    if (!hasTaskOrderIndex && tableInfo.length > 0) {
        console.log('Migrating tasks table (adding order_index)...');
        const oldTasks = db.prepare('SELECT * FROM tasks').all() as any[];
        
        db.exec('DROP TABLE tasks');
        
        db.exec(`
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                column_id INTEGER,
                priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
            )
        `);

        const insert = db.prepare('INSERT INTO tasks (id, title, description, column_id, priority, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        // We can just use id as order_index for initial migration to keep roughly created order
        for (const task of oldTasks) {
             insert.run(task.id, task.title, task.description, task.column_id, task.priority, task.id, task.created_at);
        }
        db.pragma('foreign_keys = ON');
    } else if (tableInfo.length === 0) {
        db.exec(`
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                column_id INTEGER,
                priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
            )
        `);
    }
    // Attachments Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);
};

initDb();

export default db;
