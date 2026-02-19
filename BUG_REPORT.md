# 项目 Bug 分析报告

> 本文档列出了项目中发现的潜在 bug 和问题，并提供了建议的修复方案。请根据实际情况决定是否修复。

---

## 目录

- [后端问题](#后端问题)
- [前端问题](#前端问题)
- [安全问题](#安全问题)
- [未完成的功能](#未完成的功能)

---

## 后端问题

### 1. [高] JWT 认证错误状态码不一致

**位置**: `api/middleware/auth.ts:21-23`

**问题**: JWT 验证失败时返回 403 状态码，应该返回 401（未授权）。同时，token 过期和无效没有区分处理。

**当前代码**:
```typescript
jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
  if (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  // ...
});
```

**建议修复**:
```typescript
jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
  if (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
  // ...
});
```

---

### 2. [中] 密码强度没有验证

**位置**: `api/routes/auth.ts:14-46` (register), `api/routes/auth.ts:114-147` (change-password)

**问题**: 注册和修改密码时没有验证密码强度，用户可以设置空密码或极短的密码。

**建议修复**: 在验证逻辑中添加密码强度检查：
```typescript
// 建议添加
if (password.length < 6) {
  res.status(400).json({ error: 'Password must be at least 6 characters' });
  return;
}
```

---

### 3. [中] 用户名缺少验证

**位置**: `api/routes/auth.ts:14-46`

**问题**: 没有验证用户名长度和格式。

**建议修复**:
```typescript
if (!username || username.length < 2 || username.length > 50) {
  res.status(400).json({ error: 'Username must be 2-50 characters' });
  return;
}
```

---

### 4. [中] 排序操作缺少字段验证

**位置**: `api/routes/tasks.ts:149-183`, `api/routes/columns.ts:117-143`

**问题**: reorder 接口没有验证数组中每个元素是否包含必要字段，可能导致 undefined 插入数据库。

**当前代码** (`tasks.ts`):
```typescript
router.post('/reorder', (req: Request, res) => {
    const { items } = req.body;
    // items 可能是 [{ id: 1 }] 缺少 order_index 和 column_id
    // ...
});
```

**建议修复**:
```typescript
router.post('/reorder', (req: Request, res) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Items array is required and must not be empty' });
        return;
    }

    // 验证每个元素
    for (const item of items) {
        if (typeof item.id !== 'number' || typeof item.order_index !== 'number' || typeof item.column_id !== 'number') {
            res.status(400).json({ success: false, error: 'Each item must have id, order_index, and column_id as numbers' });
            return;
        }
    }
    // ...
});
```

---

### 5. [中] 删除列后 order_index 出现间隙

**位置**: `api/routes/columns.ts:145-172`

**问题**: 删除列后，其他列的 order_index 不会重新排序，导致序号不连续。

**建议修复**: 在删除列后重新排序：
```typescript
router.delete('/:id', (req: Request, res) => {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  if (!checkColumnAccess(userId!, Number(id))) {
      res.status(403).json({ success: false, error: 'Unauthorized access to column' });
      return;
  }

  try {
    // 获取要删除的列的 order_index 和 project_id
    const colInfo = db.prepare('SELECT order_index, project_id FROM columns WHERE id = ?').get(id) as { order_index: number, project_id: number };

    db.transaction(() => {
        const deleteTasks = db.prepare('DELETE FROM tasks WHERE column_id = ?');
        const deleteColumn = db.prepare('DELETE FROM columns WHERE id = ?');

        deleteTasks.run(id);
        deleteColumn.run(id);

        // 重新排序剩余列
        if (colInfo) {
            const remainingCols = db.prepare('SELECT id FROM columns WHERE project_id = ? AND id != ? ORDER BY order_index').all(colInfo.project_id, id) as {id: number}[];
            const updateStmt = db.prepare('UPDATE columns SET order_index = ? WHERE id = ?');
            remainingCols.forEach((col, index) => {
                updateStmt.run(index, col.id);
            });
        }
    })();

    res.json({ success: true, message: 'Column deleted' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
```

---

### 6. [中] 删除任务后 order_index 出现间隙

**位置**: `api/routes/tasks.ts:185-207`

**问题**: 与列删除类似，删除任务后其他任务的 order_index 不会重新排序。

**建议修复**: 在删除任务后重新排序同一列中的其他任务。

---

### 7. [中] 项目删除时未清理附件文件

**位置**: `api/routes/projects.ts:87-117`

**问题**: 删除项目时，只删除了数据库记录，但对应的上传文件（uploads 目录下的文件）没有被删除。

**建议修复**:
```typescript
router.delete('/:id', (req: Request, res) => {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;

    try {
        const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found or unauthorized' });
            return;
        }

        // 获取项目下的所有列和任务ID
        const cols = db.prepare('SELECT id FROM columns WHERE project_id = ?').all(id) as {id: number}[];
        const colIds = cols.map(c => c.id);

        // 获取要删除的文件路径
        const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
        const filesToDelete: string[] = [];

        if (colIds.length > 0) {
            // 获取附件文件路径
            const attachments = db.prepare(`SELECT file_path FROM attachments WHERE column_id IN (${colIds.join(',')})`).all() as {file_path: string}[];
            filesToDelete.push(...attachments.map(a => path.join(uploadDir, a.file_path)));
        }

        // 删除数据库记录
        db.transaction(() => {
            if (colIds.length > 0) {
                db.prepare(`DELETE FROM attachments WHERE column_id IN (${colIds.join(',')})`).run();
                db.prepare('DELETE FROM tasks WHERE column_id IN (${colIds.join(',')})').run();
                db.prepare('DELETE FROM columns WHERE project_id = ?').run(id);
            }
            db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        })();

        // 删除物理文件
        for (const filePath of filesToDelete) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (e) {
                console.error('Failed to delete file:', filePath, e);
            }
        }

        // 删除项目上传目录
        const projectDir = path.join(uploadDir, id);
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }

        res.json({ success: true, message: 'Project deleted' });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});
```

---

### 8. [低] 上传目录遍历潜在风险

**位置**: `api/routes/attachments.ts:12-45`

**问题**: 在确定上传目录时，如果 taskId 无效，projectId 可能变成字符串 'misc'，虽然当前代码使用相对路径，但仍存在潜在风险。

**建议修复**: 添加更严格的验证。

---

### 9. [低] API 响应格式不一致

**问题**: 有些接口返回 `{ success: true, data: ... }`，有些直接返回数据。这会给前端调用带来不便。

**建议**: 统一所有 API 响应格式。

---

## 前端问题

### 10. [中] checkAuth 不验证 token 有效性

**位置**: `src/store/authStore.ts:61-76`

**问题**: 初始化时只检查 localStorage 中是否存在 token，但不验证 token 是否有效（未调用 /api/auth/me 验证）。

**当前代码**:
```typescript
checkAuth: () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (token && userStr) {
    // 直接信任 token，不验证
    try {
      const user = JSON.parse(userStr);
      set({ user, token, isAuthenticated: true });
    } catch (e) {
      // ...
    }
  }
}
```

**建议修复**:
```typescript
checkAuth: async () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    set({ user: null, token: null, isAuthenticated: false });
    return;
  }

  try {
    // 验证 token 有效性
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const { user } = await response.json();
      set({ user, token, isAuthenticated: true });
    } else {
      // token 无效，清除
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  } catch (e) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  }
}
```

---

### 11. [中] 删除操作不等待服务器响应

**位置**: `src/store/taskStore.ts:143-163`

**问题**: `deleteAttachment` 方法没有等待服务器返回就更新本地状态，如果服务器请求失败，UI 会显示已删除但数据实际还存在。

**当前代码**:
```typescript
deleteAttachment: async (id, taskId) => {
   try {
       const token = localStorage.getItem('token');
       const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

       await fetch(`/api/attachments/${id}`, {
           method: 'DELETE',
           headers
       });

       // 没有检查 response.ok 就更新状态
       set(state => ({
           // ...
       }));
   } catch (err: any) {
       set({ error: err.message });
   }
},
```

**建议修复**:
```typescript
deleteAttachment: async (id, taskId) => {
   const previousAttachments = get().attachments[taskId] || [];

   // 乐观更新
   set(state => ({
       attachments: {
           ...state.attachments,
           [taskId]: (state.attachments[taskId] || []).filter(a => a.id !== id)
       },
       tasks: state.tasks.map(t => t.id === taskId ? { ...t, attachment_count: Math.max((t.attachment_count || 0) - 1, 0) } : t)
   }));

   try {
       const token = localStorage.getItem('token');
       const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

       const response = await fetch(`/api/attachments/${id}`, {
           method: 'DELETE',
           headers
       });

       if (!response.ok) {
           // 恢复原状态
           set({ attachments: { ...get().attachments, [taskId]: previousAttachments } });
           set({ error: 'Failed to delete attachment' });
       }
   } catch (err: any) {
       // 恢复原状态
       set({ attachments: { ...get().attachments, [taskId]: previousAttachments } });
       set({ error: err.message });
   }
},
```

---

### 12. [低] 删除项目后状态清理不完整

**位置**: `src/store/taskStore.ts:286-316`

**问题**: 删除项目后，tasks 和 columns 数组可能包含已删除项目的数据，应该在切换到新项目时完全覆盖。

**说明**: 当前代码在 `fetchProjectData` 中会重新获取数据，这个问题影响较小。

---

### 13. [低] 前端缺少输入验证

**位置**: 多个 store 方法

**问题**: `addTask`、`addColumn` 等方法没有在前端验证必填字段。

**建议**: 添加前端验证，提升用户体验。

---

## 安全问题

### 14. [高] JWT 密钥硬编码

**位置**: `api/middleware/auth.ts:4`, `api/routes/auth.ts:8`

**问题**: 默认 JWT 密钥是硬编码的字符串 `your-secret-key`，在生产环境中应该使用强随机密钥。

**建议**:
```bash
# 在 .env 文件中设置
JWT_SECRET=your-strong-random-secret-key-here
```

---

### 15. [中] 上传文件没有大小限制

**位置**: `api/routes/attachments.ts:54`

**问题**: 没有配置上传文件大小限制。

**建议**:
```typescript
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});
```

---

### 16. [中] 上传文件类型没有验证

**位置**: `api/routes/attachments.ts`

**问题**: 没有验证上传文件的 MIME 类型，可能导致恶意文件上传。

**建议**:
```typescript
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

---

### 17. [低] 附件接口路径问题

**位置**: `api/app.ts:45`

**问题**: attachmentsRoutes 挂载在 `/api` 下，但内部路由使用 `/tasks/:taskId/attachments`，这意味着完整路径是 `/api/tasks/:taskId/attachments`，与 tasks 路由冲突。

**当前代码**:
```typescript
app.use('/api', authenticateToken, attachmentsRoutes);
// attachments.ts 内部: router.get('/tasks/:taskId/attachments', ...)
// 实际路径: /api/tasks/:taskId/attachments
```

**说明**: 代码可以工作是因为 Express 按顺序匹配，但这种挂载方式不够直观。

---

## 未完成的功能

### 18. 项目描述字段无法更新

**位置**: `api/routes/projects.ts:119-149`

**问题**: `updateProject` 接口只接受 `name` 参数，无法更新 `description`。

**建议修复**:
```typescript
router.put('/:id', (req: Request, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    // ... 支持更新 description
});
```

---

### 19. 列无法更新 order_index

**位置**: `api/routes/columns.ts:72-114`

**问题**: `updateColumn` 接口不支持直接更新 `order_index`。

---

### 20. 任务优先级没有数值范围验证

**位置**: `api/routes/tasks.ts`

**问题**: 优先级字段没有验证范围。

---

## 优先级说明

- **[高]**: 需要尽快修复，可能导致数据泄露或功能失效
- **[中]**: 建议修复，影响用户体验或数据一致性
- **[低]**: 可选修复，不影响核心功能

---

## 总结

| 优先级 | 数量 |
|--------|------|
| 高     | 2    |
| 中     | 12   |
| 低     | 6    |
| **总计** | **20** |

建议优先修复 **问题 1、14**（安全性相关）和 **问题 10、11**（用户体验相关）。
