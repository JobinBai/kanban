/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import tasksRoutes from './routes/tasks.js'
import columnsRoutes from './routes/columns.js'
import projectsRoutes from './routes/projects.js'
import authRoutes from './routes/auth.js'
import attachmentsRoutes from './routes/attachments.js'
import { authenticateToken } from './middleware/auth.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve Uploads - Public access or protected? For simplicity now, public if you have the link
const uploadsPath = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads')
app.use('/uploads', express.static(uploadsPath))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/projects', authenticateToken, projectsRoutes)
app.use('/api/columns', authenticateToken, columnsRoutes)
app.use('/api/tasks', authenticateToken, tasksRoutes)
app.use('/api', authenticateToken, attachmentsRoutes)


/**
 * Serve static files
 */
const distPath = path.resolve(__dirname, '../../dist')
app.use(express.static(distPath))

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * SPA Fallback
 */
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next()
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
