import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  CollisionDetection
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, PlusSquare, LogOut, X, ChevronDown, Lock, Github } from 'lucide-react';
import { KanbanColumn } from '../components/KanbanColumn';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { ColumnModal } from '../components/ColumnModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { useTaskStore, Task, Project } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

// Project Tab Component
function ProjectTab({ 
    project, 
    isActive, 
    onClick, 
    onEdit, 
    onDelete, 
    isEditing, 
    editName, 
    setEditName, 
    onSaveEdit 
}: {
    project: Project;
    isActive: boolean;
    onClick: () => void;
    onEdit: () => void;
    onDelete: (id: number) => void;
    isEditing: boolean;
    editName: string;
    setEditName: (name: string) => void;
    onSaveEdit: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `proj-${project.id}`,
        data: {
            type: 'Project',
            project
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes} 
            {...(isEditing ? {} : listeners)}
            onClick={onClick}
            className={`
                group relative flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer select-none transition-all border-b-2 min-w-[120px] max-w-[200px] justify-between outline-none
                ${isActive 
                    ? 'bg-white border-blue-500 text-blue-600 font-bold shadow-sm z-10' 
                    : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }
            `}
        >
            {isEditing ? (
                <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                        // Delay save to allow click events on other elements (like switching tabs) to fire first
                        setTimeout(onSaveEdit, 100);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSaveEdit();
                        if (e.key === 'Escape') onSaveEdit(); // Or cancel
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-b border-blue-500 focus:outline-none w-full text-sm"
                />
            ) : (
                <span 
                    className="truncate flex-1 text-sm"
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    title={project.name}
                >
                    {project.name}
                </span>
            )}
            
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    const inputName = window.prompt(`请输入项目名称 "${project.name}" 以确认删除:`);
                    if (inputName && inputName.trim() === project.name) {
                        onDelete(project.id);
                    } else if (inputName !== null) {
                        alert('项目名称不匹配，删除已取消。');
                    }
                }}
                className={`
                    p-1 rounded-full hover:bg-red-100 hover:text-red-500 transition-opacity flex-shrink-0
                    ${isActive ? 'opacity-0 group-hover:opacity-100' : 'hidden'}
                `}
                title="删除项目"
            >
                <X size={12} />
            </button>
        </div>
    );
}

export default function Home() {
  const { 
      tasks, 
      columns, 
      projects,
      currentProjectId,
      fetchProjects, 
      updateTask, 
      reorderTasks,
      deleteTask, 
      addTask, 
      addColumn,
      updateColumn,
      reorderColumns,
      deleteColumn,
      setCurrentProject,
      addProject,
      updateProject,
      deleteProject,
      reorderProjects
  } = useTaskStore();
  
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [userMenuTimeout, setUserMenuTimeout] = useState<NodeJS.Timeout | null>(null);

  // ...

  const handleUserMenuLeave = () => {
      const timeout = setTimeout(() => {
          setIsUserMenuOpen(false);
      }, 500); // 500ms delay
      setUserMenuTimeout(timeout);
  };

  const handleUserMenuEnter = () => {
      if (userMenuTimeout) {
          clearTimeout(userMenuTimeout);
          setUserMenuTimeout(null);
      }
  };
  const [activeType, setActiveType] = useState<'Task' | 'Column' | 'Project' | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [defaultColumnId, setDefaultColumnId] = useState<number | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  // Project State
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (isCreatingProject && newProjectInputRef.current) {
        newProjectInputRef.current.focus();
    }
  }, [isCreatingProject]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
      // If dragging a Project or Column, stick to closestCorners
      if (activeType === 'Project' || activeType === 'Column') {
          return closestCorners(args);
      }

      // Task dragging
      // First, look for precise pointer collisions
      const pointerCollisions = pointerWithin(args);
      
      if (pointerCollisions.length > 0) {
          // Check if we are over a Task
          const overTask = pointerCollisions.find(c => String(c.id).startsWith('task-'));
          if (overTask) {
              // We are over a task, standard closestCorners is fine for sorting precision
              return closestCorners(args);
          }
          
          // Check if we are over a Column
          const overColumn = pointerCollisions.find(c => String(c.id).startsWith('col-'));
          if (overColumn) {
               // We are inside a column but not over any task.
               // This is the "Empty Column" or "Empty space in Column" scenario.
               return [{ id: overColumn.id }];
          }
      }

      // Fallback to rectIntersection if pointer missed everything (e.g. fast movement or overlay issues)
      const rectCollisions = rectIntersection(args);
      const overColumnRect = rectCollisions.find(c => String(c.id).startsWith('col-'));
      if (overColumnRect) {
          return [{ id: overColumnRect.id }];
      }

      // Fallback
      return closestCorners(args);
  }, [activeType]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeIdStr = String(event.active.id);
    if (activeIdStr.startsWith('col-')) {
        setActiveType('Column');
        setActiveId(Number(activeIdStr.replace('col-', '')));
    } else if (activeIdStr.startsWith('task-')) {
        setActiveType('Task');
        setActiveId(Number(activeIdStr.replace('task-', '')));
    } else if (activeIdStr.startsWith('proj-')) {
        setActiveType('Project');
        setActiveId(Number(activeIdStr.replace('proj-', '')));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
        setActiveId(null);
        setActiveType(null);
        return;
    }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Project Reordering
    if (activeIdStr.startsWith('proj-') && overIdStr.startsWith('proj-')) {
        if (active.id !== over.id) {
            const oldIndex = projects.findIndex(p => `proj-${p.id}` === active.id);
            const newIndex = projects.findIndex(p => `proj-${p.id}` === over.id);
            
            const newProjects = arrayMove(projects, oldIndex, newIndex);
            reorderProjects(newProjects.map(p => p.id));
        }
    }
    // Column Reordering
    else if (activeIdStr.startsWith('col-') && overIdStr.startsWith('col-')) {
        if (active.id !== over.id) {
            const oldIndex = columns.findIndex(c => `col-${c.id}` === active.id);
            const newIndex = columns.findIndex(c => `col-${c.id}` === over.id);
            
            const newColumns = arrayMove(columns, oldIndex, newIndex);
            
            const updatedColumns = newColumns.map((c, index) => ({
                ...c,
                order_index: index
            }));

            const updates = updatedColumns.map(c => ({
                id: c.id,
                order_index: c.order_index
            }));

            reorderColumns(updates, updatedColumns);
        }
    }
    // Task Reordering
    else if (activeIdStr.startsWith('task-')) {
        const activeId = Number(activeIdStr.replace('task-', ''));
        const activeTask = tasks.find(t => t.id === activeId);
        if (!activeTask) {
            setActiveId(null);
            return;
        }

        let targetColumnId: number | null = null;
        let newIndex: number | null = null;

        // Dropped over a column
        if (overIdStr.startsWith('col-')) {
            targetColumnId = Number(overIdStr.replace('col-', ''));
            const tasksInColumn = tasks.filter(t => t.column_id === targetColumnId);
            newIndex = tasksInColumn.length;
        } 
        // Dropped over another task
        else if (overIdStr.startsWith('task-')) {
            const overTaskId = Number(overIdStr.replace('task-', ''));
            const overTask = tasks.find(t => t.id === overTaskId);
            if (overTask) {
                targetColumnId = overTask.column_id;
                const tasksInTargetColumn = tasks
                    .filter(t => t.column_id === targetColumnId)
                    .sort((a, b) => a.order_index - b.order_index);
                
                const overTaskIndex = tasksInTargetColumn.findIndex(t => t.id === overTaskId);
                newIndex = overTaskIndex;
            }
        }

        if (targetColumnId !== null) {
            let targetTasks = tasks.filter(t => t.column_id === targetColumnId && t.id !== activeId);
            targetTasks.sort((a, b) => a.order_index - b.order_index);
            
            if (newIndex === null || newIndex === undefined) newIndex = targetTasks.length;
            
            targetTasks.splice(newIndex, 0, { ...activeTask, column_id: targetColumnId });
            
            const updatedTargetTasks = targetTasks.map((t, index) => ({
                ...t,
                order_index: index
            }));

            const otherTasks = tasks.filter(t => t.column_id !== targetColumnId && t.id !== activeId);
            const optimisticTasks = [...otherTasks, ...updatedTargetTasks];

            const updates = updatedTargetTasks.map(t => ({
                id: t.id,
                column_id: t.column_id,
                order_index: t.order_index
            }));

            reorderTasks(updates, optimisticTasks);
        }
    }

    setActiveId(null);
    setActiveType(null);
  };

  const handleAddColumn = () => {
      setIsColumnModalOpen(true);
  };

  const handleCreateProject = () => {
      if (newProjectName.trim()) {
          addProject(newProjectName.trim());
          setNewProjectName('');
          setIsCreatingProject(false);
      } else {
          setIsCreatingProject(false);
      }
  };
  
  const handleUpdateProjectName = () => {
      if (editingProjectId && editProjectName.trim()) {
          const project = projects.find(p => p.id === editingProjectId);
          if (project && project.name !== editProjectName.trim()) {
              updateProject(editingProjectId, editProjectName.trim());
          }
      }
      setEditingProjectId(null);
  };

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  const activeTask = activeType === 'Task' && activeId ? tasks.find(t => t.id === activeId) : null;
  const activeColumn = activeType === 'Column' && activeId ? columns.find(c => c.id === activeId) : null;
  const activeProject = activeType === 'Project' && activeId ? projects.find(p => p.id === activeId) : null;

  return (
    <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
        <div className="flex h-screen bg-gray-50 font-sans overflow-hidden flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 pt-4 px-6 flex justify-between items-end flex-shrink-0 z-40 relative shadow-sm h-16">
                
                {/* Left: Project Tabs */}
                <div className="flex-1 flex overflow-x-auto no-scrollbar items-end gap-1 mr-4">
                    <SortableContext items={projects.map(p => `proj-${p.id}`)} strategy={horizontalListSortingStrategy}>
                        {projects.map(project => (
                            <ProjectTab 
                                key={project.id}
                                project={project}
                                isActive={currentProjectId === project.id}
                                onClick={() => setCurrentProject(project.id)}
                                onEdit={() => {
                                    setEditingProjectId(project.id);
                                    setEditProjectName(project.name);
                                }}
                                onDelete={deleteProject}
                                isEditing={editingProjectId === project.id}
                                editName={editProjectName}
                                setEditName={setEditProjectName}
                                onSaveEdit={handleUpdateProjectName}
                            />
                        ))}
                    </SortableContext>
                    
                    {/* Add Project Button */}
                    {isCreatingProject ? (
                        <div className="flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-t-lg border-b-2 border-gray-300">
                            <input
                                ref={newProjectInputRef}
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                onBlur={handleCreateProject}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateProject();
                                    if (e.key === 'Escape') setIsCreatingProject(false);
                                }}
                                className="bg-transparent border-b border-gray-400 focus:outline-none w-24 text-sm"
                                placeholder="新项目"
                            />
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsCreatingProject(true)}
                            className="p-2 rounded-t-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            title="创建新项目"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>

                {/* Right: User Info & Actions */}
                <div className="flex items-center gap-4 pb-2">
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddColumn}
                            disabled={!currentProjectId}
                            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            <PlusSquare size={18} />
                            <span className="hidden sm:inline">添加分组</span>
                        </button>
                        <button
                            onClick={() => {
                            setEditingTask(null);
                            setDefaultColumnId(null);
                            setIsModalOpen(true);
                        }}
                            disabled={!currentProjectId}
                            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 text-sm font-medium"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">添加任务</span>
                        </button>
                    </div>

                    <div 
                        className="flex items-center gap-3 border-l border-gray-200 pl-4 relative"
                        onMouseLeave={handleUserMenuLeave}
                        onMouseEnter={handleUserMenuEnter}
                    >
                        <button 
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-1 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                {user?.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.username}</span>
                            <ChevronDown size={14} className="text-gray-400" />
                        </button>

                        {/* User Dropdown Menu */}
                        {isUserMenuOpen && (
                            <div className="absolute right-0 top-full pt-2 w-48 z-50">
                                <div className="bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-4 py-2 border-b border-gray-50">
                                        <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsChangePasswordModalOpen(true);
                                            setIsUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Lock size={14} /> 修改密码
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <LogOut size={14} /> 退出登录
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <a
                        href="https://github.com/JobinBai/kanban"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                        title="GitHub Repository"
                    >
                        <Github size={20} />
                    </a>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden relative">
                <main className="h-full overflow-x-auto overflow-y-hidden p-6">
                    {!currentProjectId ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                                <PlusSquare size={32} className="text-gray-300" />
                            </div>
                            <p className="text-lg font-medium text-gray-500">请选择或创建一个项目以开始</p>
                            <button 
                                onClick={() => setIsCreatingProject(true)}
                                className="text-blue-600 hover:underline"
                            >
                                创建新项目
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-row gap-6 h-full pb-2">
                            <SortableContext items={columns.map(c => `col-${c.id}`)} strategy={horizontalListSortingStrategy}>
                                {columns.map(column => (
                                    <KanbanColumn
                                        key={column.id}
                                        id={column.id}
                                        title={column.title}
                                        color={column.color}
                                        tasks={tasks
                                            .filter(t => t.column_id === column.id)
                                            .sort((a, b) => a.order_index - b.order_index)
                                        }
                                        onDeleteTask={deleteTask}
                                        onEditTask={(task) => {
                                            setEditingTask(task);
                                            setIsModalOpen(true);
                                        }}
                                        onUpdateColumn={updateColumn}
                                        onDeleteColumn={deleteColumn}
                                        onAddTask={(columnId) => {
                                            setEditingTask(null);
                                            setDefaultColumnId(columnId);
                                            setIsModalOpen(true);
                                        }}
                                        onReorderTasks={reorderTasks}
                                    />
                                ))}
                            </SortableContext>
                            
                            {/* Empty State / Add Column Hint */}
                            {columns.length === 0 && (
                                <div className="flex items-center justify-center w-full h-full border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                                    <div className="text-center">
                                        <p>暂无分组</p>
                                        <button onClick={handleAddColumn} className="text-blue-500 hover:underline mt-2">创建第一个分组</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeType === 'Task' && activeTask ? (
                    <div className="transform rotate-3 cursor-grabbing opacity-80 w-[300px]">
                        <TaskCard task={activeTask} onDelete={() => {}} onEdit={() => {}} />
                    </div>
                ) : null}
                {activeType === 'Column' && activeColumn ? (
                        <div className="transform rotate-3 cursor-grabbing opacity-80 h-full">
                        <KanbanColumn
                            id={activeColumn.id}
                            title={activeColumn.title}
                            color={activeColumn.color}
                            tasks={tasks.filter(t => t.column_id === activeColumn.id)}
                            onDeleteTask={() => {}}
                            onEditTask={() => {}}
                            onUpdateColumn={() => {}}
                            onDeleteColumn={() => {}}
                            onAddTask={() => {}}
                            onReorderTasks={() => {}}
                        />
                    </div>
                ) : null}
                {activeType === 'Project' && activeProject ? (
                    <div className="bg-white border-blue-500 text-blue-600 font-bold px-4 py-2 rounded-t-lg border-b-2 shadow-lg opacity-80 min-w-[120px]">
                        {activeProject.name}
                    </div>
                ) : null}
            </DragOverlay>

            <TaskModal
              isOpen={isModalOpen}
              initialData={editingTask}
              onClose={() => {
                  setIsModalOpen(false);
                  setEditingTask(null);
              }}
              onSubmit={async (title, description, priority, files) => {
                  if (editingTask) {
                      updateTask(editingTask.id, { title, description, priority });
                  } else if (defaultColumnId) {
                      const newTask = await addTask(title, description, defaultColumnId, priority);
                      if (newTask && files.length > 0) {
                          for (const file of files) {
                              await useTaskStore.getState().uploadAttachment(newTask.id, file);
                          }
                      }
                  } else if (columns.length > 0) {
                      const newTask = await addTask(title, description, columns[0].id, priority);
                      if (newTask && files.length > 0) {
                          for (const file of files) {
                              await useTaskStore.getState().uploadAttachment(newTask.id, file);
                          }
                      }
                  } else {
                      alert('请先添加至少一个分组！');
                  }
              }}
            />
            
            <ColumnModal
                isOpen={isColumnModalOpen}
                onClose={() => setIsColumnModalOpen(false)}
                onSubmit={(title) => {
                    if (currentProjectId) {
                        addColumn(title, currentProjectId);
                    }
                }}
            />
            
            <ChangePasswordModal 
                isOpen={isChangePasswordModalOpen}
                onClose={() => setIsChangePasswordModalOpen(false)}
            />
        </div>
    </DndContext>
  );
}
