# Kanban 看板项目文档

## 项目概述

这是一个功能完整的 **Kanban 看板 Web 应用**，支持用户管理项目、列和任务，具备拖拽排序、附件上传等功能。前后端分离架构，使用 React + Express + SQLite 技术栈。

---

## 技术栈

### 前端
| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18.3.1 | UI 框架 |
| React Router DOM | 7.3.0 | 路由管理 |
| Zustand | 5.0.3 | 状态管理 |
| @dnd-kit | 最新版 | 拖拽排序 |
| Tailwind CSS | 3.4.17 | 样式框架 |
| Vite | 6.3.5 | 构建工具 |
| TypeScript | - | 语言 |

### 后端
| 技术 | 版本 | 说明 |
|------|------|------|
| Express | 4.21.2 | Web 框架 |
| better-sqlite3 | 12.6.2 | SQLite 驱动 |
| jsonwebtoken | 9.0.3 | JWT 认证 |
| bcryptjs | 2.4.3 | 密码加密 |
| multer | 2.0.2 | 文件上传 |

---

## 项目结构

```
/Users/jobin/work/demo/kanban/
├── api/                          # 后端服务
│   ├── app.ts                    # Express 应用
│   ├── server.ts                 # 服务器入口
│   ├── db.ts                     # 数据库初始化
│   ├── index.ts                  # 索引文件
│   ├── middleware/
│   │   └── auth.ts               # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.ts               # 认证路由
│   │   ├── projects.ts           # 项目路由
│   │   ├── columns.ts            # 列路由
│   │   ├── tasks.ts              # 任务路由
│   │   └── attachments.ts        # 附件路由
│   └── utils/
│       └── permissions.ts        # 权限控制函数
├── src/                          # 前端源码
│   ├── main.tsx                  # 入口文件
│   ├── App.tsx                   # 主应用
│   ├── index.css                 # 全局样式
│   ├── components/               # 组件
│   │   ├── Home.tsx              # 主页面
│   │   ├── KanbanColumn.tsx      # 看板列
│   │   ├── TaskCard.tsx          # 任务卡片
│   │   ├── TaskModal.tsx         # 任务弹窗
│   │   ├── ColumnModal.tsx       # 列弹窗
│   │   ├── ProjectSidebar.tsx    # 项目侧边栏
│   │   ├── Login.tsx             # 登录页
│   │   ├── Register.tsx          # 注册页
│   │   └── ...
│   ├── pages/                    # 页面
│   └── store/                    # 状态管理
│       ├── authStore.ts          # 认证状态
│       └── taskStore.ts          # 任务状态
├── uploads/                      # 上传文件目录
├── kanban.db                     # SQLite 数据库
├── schema.sql                    # 数据库 Schema
├── package.json                  # 依赖配置
├── vite.config.ts                # Vite 配置
├── tailwind.config.js            # Tailwind 配置
├── Dockerfile                    # Docker 构建
└── docker-compose.yml            # Docker Compose
```

---

## 功能列表

### 用户模块
- [x] 用户注册
- [x] 用户登录
- [x] 获取当前用户信息
- [x] 修改密码
- [x] JWT Token 认证（30天有效期）

### 项目模块
- [x] 创建项目
- [x] 获取项目列表
- [x] 更新项目信息
- [x] 删除项目
- [x] 项目拖拽排序
- [x] 项目访问权限控制

### 列模块
- [x] 创建列
- [x] 获取列列表
- [x] 更新列信息
- [x] 删除列
- [x] 列拖拽排序
- [x] 列颜色设置

### 任务模块
- [x] 创建任务
- [x] 获取任务列表
- [x] 更新任务信息
- [x] 删除任务
- [x] 任务拖拽排序
- [x] 任务优先级设置
- [x] 任务描述编辑

### 附件模块
- [x] 上传附件
- [x] 获取附件列表
- [x] 删除附件
- [x] 支持图片/文件上传

---

## API 接口文档

### 认证接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/auth/register | 否 | 用户注册 |
| POST | /api/auth/login | 否 | 用户登录 |
| GET | /api/auth/me | 是 | 获取当前用户 |
| POST | /api/auth/change-password | 是 | 修改密码 |

#### 注册接口
```
POST /api/auth/register
Content-Type: application/json

Request:
{
  "username": "string",
  "password": "string"
}

Response (200):
{
  "id": "number",
  "username": "string"
}
```

#### 登录接口
```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "username": "string",
  "password": "string"
}

Response (200):
{
  "token": "string",
  "user": {
    "id": "number",
    "username": "string"
  }
}
```

---

### 项目接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/projects | 是 | 获取项目列表 |
| POST | /api/projects | 是 | 创建项目 |
| PUT | /api/projects/:id | 是 | 更新项目 |
| DELETE | /api/projects/:id | 是 | 删除项目 |
| PUT | /api/projects/reorder | 是 | 项目排序 |

#### 创建项目
```
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "name": "string",
  "description": "string (optional)"
}

Response (200):
{
  "id": "number",
  "name": "string",
  "description": "string",
  "user_id": "number",
  "order_index": "number",
  "created_at": "string"
}
```

---

### 列接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/columns?project_id=:id | 是 | 获取列 |
| POST | /api/columns | 是 | 创建列 |
| PUT | /api/columns/:id | 是 | 更新列 |
| DELETE | /api/columns/:id | 是 | 删除列 |
| POST | /api/columns/reorder | 是 | 列排序 |

---

### 任务接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/tasks?project_id=:id | 是 | 获取任务 |
| POST | /api/tasks | 是 | 创建任务 |
| PUT | /api/tasks/:id | 是 | 更新任务 |
| DELETE | /api/tasks/:id | 是 | 删除任务 |
| POST | /api/tasks/reorder | 是 | 任务排序 |

#### 任务数据结构
```typescript
interface Task {
  id: number;
  title: string;
  description: string;
  column_id: number;
  priority: 'low' | 'medium' | 'high';
  order_index: number;
  created_at: string;
}
```

---

### 附件接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/tasks/:taskId/attachments | 是 | 获取附件 |
| POST | /api/tasks/:taskId/attachments | 是 | 上传附件 |
| DELETE | /api/attachments/:id | 是 | 删除附件 |

---

## 数据库设计

### 表结构

```sql
-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  user_id INTEGER NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 列表
CREATE TABLE columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  project_id INTEGER NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 任务表
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  column_id INTEGER NOT NULL,
  priority TEXT DEFAULT 'medium',
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);

-- 附件表
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

---

## 权限控制

### 权限检查函数 (`api/utils/permissions.ts`)

| 函数 | 说明 |
|------|------|
| `checkProjectAccess(userId, projectId)` | 验证用户是否拥有项目 |
| `checkColumnAccess(userId, columnId)` | 验证用户是否拥有列 |
| `checkTaskAccess(userId, taskId)` | 验证用户是否拥有任务 |

所有项目、列、任务数据都关联到用户 ID，确保用户只能访问自己的数据。

---

## 运行指南

### 环境要求
- Node.js 18+
- pnpm / npm

### 安装依赖
```bash
pnpm install
# 或
npm install
```

### 开发模式
```bash
pnpm dev
```
同时启动前端（端口 5173）和后端（端口 3000）

### 生产构建
```bash
pnpm build
pnpm start
```

### Docker 部署
```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

---

## 前端页面路由

| 路径 | 组件 | 认证 | 说明 |
|------|------|------|------|
| / | Home | 是 | 主看板页面 |
| /login | Login | 否 | 登录页 |
| /register | Register | 否 | 注册页 |

---

## 状态管理

### AuthStore (`src/store/authStore.ts`)
- `user`: 当前用户信息
- `token`: JWT Token
- `login()`: 登录
- `register()`: 注册
- `logout()`: 登出
- `changePassword()`: 修改密码

### TaskStore (`src/store/taskStore.ts`)
- `projects`: 项目列表
- `columns`: 列列表
- `tasks`: 任务列表
- `currentProjectId`: 当前项目
- CRUD 操作方法
- 拖拽排序方法

---

## 配置说明

### 环境变量
可在 `.env` 文件中配置：
- `PORT`: 后端端口（默认 3000）
- `JWT_SECRET`: JWT 密钥
- `UPLOAD_DIR`: 上传目录

### Vite 配置 (`vite.config.ts`)
- 代理配置：API 请求转发到后端
- 开发服务器端口：5173

---

## 部署说明

### Vercel 部署
项目已配置 `vercel.json`，可自动部署到 Vercel。

### Docker 部署
1. 构建镜像：
   ```bash
   docker build -t kanban .
   ```
2. 运行容器：
   ```bash
   docker run -p 3000:3000 kanban
   ```

---

## 常见问题

### 1. 如何重置数据库？
删除 `kanban.db` 文件，重新启动服务会自动创建新数据库。

### 2. 如何查看上传的文件？
文件保存在 `uploads/` 目录，可通过 `/api/uploads/:filename` 访问。

### 3. 如何修改 JWT 有效期？
在 `api/middleware/auth.ts` 中修改 token 过期时间。

---

## 更新日志

### v1.0.0
- 初始版本发布
- 用户认证（注册/登录/JWT）
- 项目/列/任务 CRUD
- 拖拽排序
- 附件上传
- 访问权限控制
