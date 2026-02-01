# Modern Kanban System

A modern, full-stack Kanban board application built with React, Node.js, and SQLite.

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?logo=github)](https://github.com/JobinBai/kanban)

## ✨ Features

- **🔐 Authentication**: Secure JWT-based signup and login.
- **📂 Multi-Project**: Manage multiple projects with ease.
- **📊 Drag & Drop**: Smooth Kanban board experience powered by `@dnd-kit`.
- **🎨 Modern UI**: Responsive design with Tailwind CSS.
- **📁 Attachments**: File uploads with preview support.

## 🚀 Quick Start

### Using Docker Run

You can quickly start the application using the following command:

```bash
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  --name kanban-app \
  jobinbai/kanban:latest
```

Open your browser and visit `http://localhost:3001`.

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  kanban:
    image: jobinbai/kanban:latest
    container_name: kanban-app
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - DB_PATH=/app/data/kanban.db
      - UPLOAD_DIR=/app/data/uploads
```

Then run:

```bash
docker-compose up -d
```

## 💾 Data Persistence

The application stores data in a SQLite database and an uploads directory. To ensure your data persists across container restarts, mount a volume to `/app/data`.

- Database: `/app/data/kanban.db`
- Uploads: `/app/data/uploads`

## 🔗 Links

- **GitHub Repository**: [https://github.com/JobinBai/kanban](https://github.com/JobinBai/kanban)
- **Report Issues**: [https://github.com/JobinBai/kanban/issues](https://github.com/JobinBai/kanban/issues)
