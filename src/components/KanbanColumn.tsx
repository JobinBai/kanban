import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '../store/taskStore';
import { TaskCard } from './TaskCard';
import { Plus, Edit2, X, ArrowUpDown, Trash2, Palette } from 'lucide-react';

interface KanbanColumnProps {
  id: number;
  title: string;
  color?: string;
  tasks: Task[];
  onDeleteTask: (id: number) => void;
  onEditTask: (task: Task) => void;
  onUpdateColumn: (id: number, title?: string, color?: string) => void;
  onDeleteColumn: (id: number) => void;
  onAddTask: (columnId: number) => void;
  onReorderTasks: (items: { id: number, order_index: number, column_id: number }[], optimisticTasks?: Task[]) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
    id, title, color = '#f59e0b', tasks, onDeleteTask, onEditTask, onUpdateColumn, onDeleteColumn, onAddTask, onReorderTasks
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleMenuLeave = () => {
      const timeout = setTimeout(() => {
          setIsMenuOpen(false);
          setShowColorPicker(false);
      }, 300); // 300ms delay
      setMenuTimeout(timeout);
  };

  const handleMenuEnter = () => {
      if (menuTimeout) {
          clearTimeout(menuTimeout);
          setMenuTimeout(null);
      }
  };

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `col-${id}`,
    data: {
        type: 'Column',
        column: { id, title }
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleUpdateTitle = () => {
      if (editTitle.trim() && editTitle !== title) {
          onUpdateColumn(id, editTitle.trim());
      } else {
          setEditTitle(title); // Revert if empty
      }
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleUpdateTitle();
      if (e.key === 'Escape') {
          setEditTitle(title);
          setIsEditing(false);
      }
  };

  const handleSortByPriority = () => {
      // Sort tasks by priority descending (5 -> 1)
      const sortedTasks = [...tasks].sort((a, b) => {
          if (b.priority !== a.priority) {
              return b.priority - a.priority; // Higher priority first
          }
          return a.order_index - b.order_index; // Stable sort for same priority
      });

      const updates = sortedTasks.map((t, index) => ({
          id: t.id,
          column_id: t.column_id,
          order_index: index
      }));
      
      // Update local state by creating a new tasks array with updated order
      // We need to update the *entire* tasks list in the store, not just this column's
      // But onReorderTasks (which calls reorderTasks in store) takes optimisticTasks as the full list or we need to merge
      
      // Construct the new full task list:
      // 1. Keep tasks from other columns as is
      // 2. Replace tasks from this column with sortedTasks (with updated order_index)
      
      // Actually, onReorderTasks' second argument `optimisticTasks` expects the *complete* list of tasks if we want to update the UI immediately.
      // However, `tasks` prop passed to KanbanColumn is only *this column's* tasks.
      // We need to be careful. The parent component filters tasks.
      
      // Let's modify onReorderTasks signature in props to accept just the updates and let the store handle the full list merge?
      // Or better, let's just pass the `sortedTasks` back up?
      
      // Current store implementation of reorderTasks:
      // reorderTasks: async (items, optimisticTasks) => {
      //    if (optimisticTasks) { set({ tasks: optimisticTasks }); } ... }
      
      // So we MUST provide the full list of tasks (including other columns) to `optimisticTasks` if we want instant UI update.
      // But KanbanColumn doesn't know about other columns' tasks.
      
      // SOLUTION: We should NOT pass `optimisticTasks` from here if we don't have the full list.
      // INSTEAD, we should calculate the full list in the Parent (Home.tsx) or let the Store handle the partial update.
      
      // Let's try to update the store to handle partial updates or fix how we call it.
      // Since we can't easily get all tasks here, let's pass the sorted tasks for *this* column up to the parent?
      // Or simpler: The store's `reorderTasks` could be smarter.
      
      // But wait, `onReorderTasks` is passed from Home.tsx: `onReorderTasks={reorderTasks}`.
      
      // Let's change how we call it. We will NOT pass optimisticTasks here, but we will manually trigger a state update in the store if possible.
      // OR, we update `reorderTasks` in the store to handle "update these tasks in the state" logic.
      
      // Let's go with updating the Store to handle this better.
      // See `src/store/taskStore.ts`.
      
      // For now, let's just pass the updates. The DB will update, but UI won't reflect until fetch.
      // User says "database updated, but UI not refreshing".
      // This confirms we are missing the optimistic update.
      
      // To fix this without refactoring everything:
      // We need to merge `sortedTasks` into the current global state tasks.
      // Since we don't have global tasks here, we rely on the store.
      
      // Let's modify `reorderTasks` in `taskStore.ts` to accept a partial list for optimistic update?
      // Or better, `KanbanColumn` receives `tasks` which is a subset.
      
      // Let's modify `KanbanColumn.tsx` to NOT handle the full list update, but rely on a new prop or just pass the updates.
      // Actually, we can just call `onReorderTasks(updates)` and then trigger a fetch? No, that's slow.
      
      // BEST FIX: Update `taskStore.ts` `reorderTasks` to handle merging.
      
      onReorderTasks(updates);
      setIsMenuOpen(false);
  };

  const COLORS = [
      '#ef4444', // red
      '#f97316', // orange
      '#eab308', // yellow
      '#22c55e', // green
      '#3b82f6', // blue
      '#a855f7', // purple
      '#ec4899', // pink
      '#64748b', // slate
  ];

  return (
    <div 
        ref={setNodeRef}
        style={style}
        className="flex flex-col min-w-[320px] flex-1 bg-gray-50/80 backdrop-blur-sm border border-gray-200 rounded-xl h-full max-h-full"
    >
      {/* Header */}
      <div 
        {...attributes} 
        {...listeners}
        className="p-5 pb-2 flex justify-between items-start group cursor-grab active:cursor-grabbing relative"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
             <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></div>
             {isEditing ? (
                <input 
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleUpdateTitle}
                    onKeyDown={handleKeyDown}
                    className="font-bold text-lg text-gray-800 bg-white border border-blue-400 rounded px-2 py-0.5 w-full outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            ) : (
                <h2 
                    className="font-bold text-lg text-gray-800 tracking-tight truncate select-none"
                    onDoubleClick={() => {
                        setEditTitle(title);
                        setIsEditing(true);
                    }}
                    title={title}
                >
                    {title}
                </h2>
            )}
        </div>
        
        <div 
            className="relative"
            onMouseLeave={handleMenuLeave}
            onMouseEnter={handleMenuEnter}
        >
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                    setShowColorPicker(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
            >
                <Edit2 size={14} />
            </button>

            {/* Modal/Menu */}
            {isMenuOpen && (
                <div 
                    className="absolute right-0 top-full pt-2 w-56 z-50"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <span className="font-bold text-gray-700 text-sm">列表操作</span>
                            <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="p-1">
                            <button 
                                onClick={() => {
                                    setEditTitle(title);
                                    setIsEditing(true);
                                    setIsMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <span className="w-5 flex justify-center"><Edit2 size={16} /></span>
                                编辑标题
                            </button>

                            <div className="relative">
                                <button 
                                    onClick={() => setShowColorPicker(!showColorPicker)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-colors"
                                >
                                    <span className="w-5 flex justify-center"><Palette size={16} /></span>
                                    设置颜色
                                </button>
                                {showColorPicker && (
                                    <div className="px-4 py-2 grid grid-cols-4 gap-2 bg-gray-50 rounded-lg mx-2 mb-2">
                                        {COLORS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => {
                                                    onUpdateColumn(id, undefined, c);
                                                    setShowColorPicker(false);
                                                }}
                                                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-gray-600' : 'border-transparent'} hover:scale-110 transition-transform`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleSortByPriority}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <span className="w-5 flex justify-center"><ArrowUpDown size={16} /></span>
                                按优先级排序
                            </button>

                            <button 
                                onClick={() => {
                                    onAddTask(id);
                                    setIsMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <span className="w-5 flex justify-center"><Plus size={18} /></span>
                                添加卡片
                            </button>

                            <button 
                                onClick={() => {
                                    if(window.confirm('确定要删除此列吗？所有任务也将被删除。')) {
                                        onDeleteColumn(id);
                                    }
                                    setIsMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors"
                            >
                                <span className="w-5 flex justify-center"><Trash2 size={16} /></span>
                                删除列表
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Add Card Button (Below Header) */}
      <div className="px-5 pb-3">
          <button
            onClick={() => onAddTask(id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium"
          >
              <Plus size={18} />
              添加卡片
          </button>
      </div>
      
      {/* Task List */}
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 px-5 pb-5 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent hover:scrollbar-thumb-gray-300">
        <SortableContext items={tasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDelete={onDeleteTask} onEdit={onEditTask} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
            <div 
                className="flex-1 border-2 border-dashed border-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-sm min-h-[100px]"
            >
                拖拽至此
            </div>
        )}
      </div>
    </div>
  );
};
