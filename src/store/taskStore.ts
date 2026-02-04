import { create } from 'zustand';
import { useAuthStore } from './authStore';

export type Priority = number;

export interface Project {
    id: number;
    name: string;
    description?: string;
    created_at: string;
}

export interface Column {
  id: number;
  title: string;
  order_index: number;
  project_id: number;
  color?: string;
}

export interface Attachment {
  id: number;
  task_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  column_id: number;
  priority: Priority;
  order_index: number;
  created_at: string;
  attachment_count?: number;
}

interface TaskState {
  projects: Project[];
  currentProjectId: number | null;
  tasks: Task[];
  columns: Column[];
  attachments: Record<number, Attachment[]>;
  isLoading: boolean;
  error: string | null;
  
  fetchProjects: () => Promise<void>;
  setCurrentProject: (id: number) => void;
  fetchProjectData: (projectId: number) => Promise<void>;
  
  addProject: (name: string, description?: string) => Promise<void>;
  updateProject: (id: number, name: string) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  reorderProjects: (projectIds: number[]) => Promise<void>;

  addTask: (title: string, description: string, column_id: number, priority: Priority) => Promise<Task | null>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  reorderTasks: (items: { id: number, order_index: number, column_id: number }[], optimisticTasks?: Task[]) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  
  addColumn: (title: string, project_id: number, color?: string) => Promise<void>;
  updateColumn: (id: number, title?: string, color?: string) => Promise<void>;
  reorderColumns: (items: { id: number, order_index: number }[], optimisticColumns?: Column[]) => Promise<void>;
  deleteColumn: (id: number) => Promise<void>;

  fetchAttachments: (taskId: number) => Promise<void>;
  uploadAttachment: (taskId: number, file: File) => Promise<boolean>;
  deleteAttachment: (id: number, taskId: number) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  tasks: [],
  columns: [],
  attachments: {},
  isLoading: false,
  error: null,
  
  // ... existing methods ...
  
  fetchAttachments: async (taskId) => {
      try {
          const token = localStorage.getItem('token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const response = await fetch(`/api/tasks/${taskId}/attachments`, { headers });
          const data = await response.json();
          if (Array.isArray(data)) {
              set(state => ({
                  attachments: {
                      ...state.attachments,
                      [taskId]: data
                  }
              }));
          }
      } catch (err: any) {
          console.error("Failed to fetch attachments", err);
      }
  },

  uploadAttachment: async (taskId, file) => {
      try {
          const formData = new FormData();
          formData.append('file', file);

          const token = localStorage.getItem('token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          // FormData headers are set automatically by browser, don't set Content-Type manually
          
          const response = await fetch(`/api/tasks/${taskId}/attachments`, {
              method: 'POST',
              headers: {
                  ...headers
              },
              body: formData
          });
          
          const data = await response.json();
          
          if (response.ok) {
               set(state => ({
                   attachments: {
                       ...state.attachments,
                       [taskId]: [data, ...(state.attachments[taskId] || [])]
                   },
                   tasks: state.tasks.map(t => t.id === taskId ? { ...t, attachment_count: (t.attachment_count || 0) + 1 } : t)
               }));
               return true;
           } else {
               set({ error: data.error || 'Upload failed' });
               return false;
           }
       } catch (err: any) {
           set({ error: err.message });
           return false;
       }
   },

   deleteAttachment: async (id, taskId) => {
       try {
           const token = localStorage.getItem('token');
           const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
           
           await fetch(`/api/attachments/${id}`, {
               method: 'DELETE',
               headers
           });

           set(state => ({
               attachments: {
                   ...state.attachments,
                   [taskId]: (state.attachments[taskId] || []).filter(a => a.id !== id)
               },
               tasks: state.tasks.map(t => t.id === taskId ? { ...t, attachment_count: Math.max((t.attachment_count || 0) - 1, 0) } : t)
           }));
       } catch (err: any) {
           set({ error: err.message });
       }
   },

  
  fetchProjects: async () => {
      set({ isLoading: true, error: null });
      try {
          const token = localStorage.getItem('token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const response = await fetch('/api/projects', { headers });

          if (response.status === 401 || response.status === 403) {
              useAuthStore.getState().logout();
              return;
          }

          const data = await response.json();
          if (data.success) {
              set({ projects: data.data });
              // Select first project if none selected
              if (!get().currentProjectId && data.data.length > 0) {
                  get().setCurrentProject(data.data[0].id);
              }
          } else {
              set({ error: data.error });
          }
      } catch (err: any) {
          set({ error: err.message });
      } finally {
          set({ isLoading: false });
      }
  },

  setCurrentProject: (id: number) => {
      set({ currentProjectId: id });
      get().fetchProjectData(id);
  },

  fetchProjectData: async (projectId: number) => {
    set({ isLoading: true, error: null });
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const [tasksRes, colsRes] = await Promise.all([
        fetch(`/api/tasks?project_id=${projectId}`, { headers }),
        fetch(`/api/columns?project_id=${projectId}`, { headers })
      ]);

      if (tasksRes.status === 401 || tasksRes.status === 403 || colsRes.status === 401 || colsRes.status === 403) {
          useAuthStore.getState().logout();
          return;
      }
      
      const tasksData = await tasksRes.json();
      const colsData = await colsRes.json();
      
      if (tasksData.success && colsData.success) {
        set({ tasks: tasksData.data, columns: colsData.data });
      } else {
        set({ error: tasksData.error || colsData.error });
      }
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  addProject: async (name, description) => {
      set({ isLoading: true, error: null });
      try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/projects', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ name, description }),
          });
          const data = await response.json();
          if (data.success) {
              const newProject = data.data;
              set((state) => ({ 
                  projects: [...state.projects, newProject],
                  currentProjectId: newProject.id
              }));
              get().fetchProjectData(newProject.id);
          } else {
              set({ error: data.error });
          }
      } catch (err: any) {
          set({ error: err.message });
      } finally {
          set({ isLoading: false });
      }
  },

  updateProject: async (id, name) => {
      const previousProjects = get().projects;
      set((state) => ({
          projects: state.projects.map(p => p.id === id ? { ...p, name } : p)
      }));

      try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/projects/${id}`, {
              method: 'PUT',
              headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ name }),
          });
          const data = await response.json();
          if (!data.success) {
              set({ projects: previousProjects, error: data.error });
          }
      } catch (err: any) {
          set({ projects: previousProjects, error: err.message });
      }
  },

  deleteProject: async (id) => {
      set({ isLoading: true, error: null });
      try {
          const token = localStorage.getItem('token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const response = await fetch(`/api/projects/${id}`, { method: 'DELETE', headers });
          const data = await response.json();
          if (data.success) {
              set((state) => {
                  const newProjects = state.projects.filter(p => p.id !== id);
                  const newCurrentId = newProjects.length > 0 ? newProjects[0].id : null;
                  return { 
                      projects: newProjects,
                      currentProjectId: newCurrentId
                  };
              });
              const newId = get().currentProjectId;
              if (newId) {
                  get().fetchProjectData(newId);
              } else {
                  set({ tasks: [], columns: [] });
              }
          } else {
              set({ error: data.error });
          }
      } catch (err: any) {
          set({ error: err.message });
      } finally {
          set({ isLoading: false });
      }
  },

  reorderProjects: async (projectIds) => {
      const currentProjects = get().projects;
      // Optimistic update
      const newProjects = projectIds
          .map(id => currentProjects.find(p => p.id === id))
          .filter((p): p is Project => p !== undefined);
      
      set({ projects: newProjects });

      try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/projects/reorder', {
              method: 'PUT',
              headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ projectIds }),
          });
          
          if (response.status === 401 || response.status === 403) {
              useAuthStore.getState().logout();
              return;
          }

          const data = await response.json();
          if (!data.success) {
               set({ projects: currentProjects, error: data.error });
          }
      } catch (err: any) {
          set({ projects: currentProjects, error: err.message });
      }
  },

  addTask: async (title, description, column_id, priority) => {
    set({ isLoading: true, error: null });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ title, description, column_id, priority }),
      });
      const data = await response.json();
      if (data.success) {
        set((state) => ({ tasks: [...state.tasks, data.data] }));
        return data.data;
      } else {
        set({ error: data.error });
        return null;
      }
    } catch (err: any) {
      set({ error: err.message });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  
  updateTask: async (id, updates) => {
    // Optimistic update
    const previousTasks = get().tasks;
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!data.success) {
        // Revert on failure
        set({ tasks: previousTasks, error: data.error });
      }
    } catch (err: any) {
        set({ tasks: previousTasks, error: err.message });
    }
  },

  reorderTasks: async (items, optimisticTasks) => {
      // Optimistic update
      if (optimisticTasks) {
          set({ tasks: optimisticTasks });
      } else {
          // If no full optimistic list provided, check if we can update based on items
          // items contains { id, order_index, column_id }
          // We can merge these updates into current tasks
          const currentTasks = get().tasks;
          const updatedTasks = currentTasks.map(task => {
              const update = items.find(i => i.id === task.id);
              if (update) {
                  return { ...task, order_index: update.order_index, column_id: update.column_id };
              }
              return task;
          });
          set({ tasks: updatedTasks });
      }
      
      try {
          const token = localStorage.getItem('token');
          await fetch('/api/tasks/reorder', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ items })
          });
          
          // Force refresh to ensure consistency
          const pid = get().currentProjectId;
          if (pid) get().fetchProjectData(pid);
          
      } catch (err: any) {
          console.error("Reorder failed", err);
          // If failed, maybe revert or re-fetch
          const pid = get().currentProjectId;
          if (pid) get().fetchProjectData(pid);
      }
  },
  
  deleteTask: async (id) => {
    // Optimistic delete
    const previousTasks = get().tasks;
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json();
      if (!data.success) {
         set({ tasks: previousTasks, error: data.error });
      }
    } catch (err: any) {
      set({ tasks: previousTasks, error: err.message });
    }
  },

  addColumn: async (title, project_id, color) => {
      set({ isLoading: true, error: null });
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/columns', {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ title, project_id, color }),
        });
        const data = await response.json();
        if (data.success) {
          set((state) => ({ columns: [...state.columns, data.data] }));
        } else {
          set({ error: data.error });
        }
      } catch (err: any) {
        set({ error: err.message });
      } finally {
        set({ isLoading: false });
      }
  },

  updateColumn: async (id, title, color) => {
      const previousColumns = get().columns;
      set((state) => ({
          columns: state.columns.map(c => c.id === id ? { ...c, ...(title ? { title } : {}), ...(color ? { color } : {}) } : c)
      }));

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/columns/${id}`, {
          method: 'PUT',
          headers: { 
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ title, color }),
        });
        const data = await response.json();
        if (!data.success) {
          set({ columns: previousColumns, error: data.error });
        }
      } catch (err: any) {
        set({ columns: previousColumns, error: err.message });
      }
  },

  reorderColumns: async (items, optimisticColumns) => {
      if (optimisticColumns) {
          set({ columns: optimisticColumns });
      }

      try {
          const token = localStorage.getItem('token');
          await fetch('/api/columns/reorder', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ items })
          });
      } catch (err: any) {
          console.error("Reorder columns failed", err);
          const pid = get().currentProjectId;
          if (pid) get().fetchProjectData(pid);
      }
  },

  deleteColumn: async (id) => {
      const previousColumns = get().columns;
      set((state) => ({
          columns: state.columns.filter(c => c.id !== id),
          tasks: state.tasks.filter(t => t.column_id !== id) // Optimistically remove tasks in that column
      }));

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`/api/columns/${id}`, {
          method: 'DELETE',
          headers
        });
        const data = await response.json();
        if (!data.success) {
          set({ columns: previousColumns, error: data.error });
          const pid = get().currentProjectId;
          if (pid) get().fetchProjectData(pid);
        }
      } catch (err: any) {
        set({ columns: previousColumns, error: err.message });
        const pid = get().currentProjectId;
        if (pid) get().fetchProjectData(pid);
      }
  }
}));
