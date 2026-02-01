import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Flag, Paperclip, Loader2 } from 'lucide-react';
import { Task, useTaskStore } from '../store/taskStore';

interface TaskCardProps {
  task: Task;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDelete, onEdit }) => {
  const { uploadAttachment, attachments } = useTaskStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ 
    id: `task-${task.id}`,
    data: {
        type: 'Task',
        task
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Ensure priority is between 1 and 5, default to 3
  const priority = typeof task.priority === 'number' ? task.priority : 3;

  const getPriorityColor = (p: number) => {
      switch (p) {
          case 1: return 'text-green-500';
          case 2: return 'text-blue-500';
          case 3: return 'text-yellow-500';
          case 4: return 'text-orange-500';
          case 5: return 'text-red-500';
          default: return 'text-gray-400';
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setIsUploading(true);
        try {
            // Upload the first file
            await uploadAttachment(task.id, e.dataTransfer.files[0]);
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setIsUploading(false);
        }
    }
  };

  const hasAttachments = (attachments[task.id] && attachments[task.id].length > 0) || (task.attachment_count && task.attachment_count > 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(task);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-white p-5 rounded-xl shadow-sm mb-4 cursor-grab hover:shadow-md transition-shadow group relative border ${isDragOver ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'}`}
    >
      {/* Overlay for drag over */}
      {isDragOver && (
          <div className="absolute inset-0 bg-blue-50/90 rounded-xl flex items-center justify-center z-10">
              <div className="text-blue-600 flex flex-col items-center">
                  <Paperclip size={32} />
                  <span className="font-bold mt-2">松开上传附件</span>
              </div>
          </div>
      )}
      
      {/* Overlay for uploading */}
      {isUploading && (
          <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-lg text-gray-800 break-words pr-6">{task.title}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent drag start
            onDelete(task.id);
          }}
          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity absolute top-5 right-5"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <p className="text-base text-gray-600 break-words whitespace-pre-wrap leading-relaxed">{task.description}</p>
      <div className="mt-4 flex justify-between items-center text-xs">
          <div className="flex gap-1">
             {[1, 2, 3, 4, 5].map(i => (
                 <Flag 
                    key={i} 
                    size={14} 
                    className={i <= priority ? getPriorityColor(priority) : "text-gray-200"} 
                    fill={i <= priority ? "currentColor" : "none"}
                 />
             ))}
          </div>
          <div className="flex items-center gap-3">
              {hasAttachments && (
                  <div className="flex items-center text-gray-400" title="Has attachments">
                      <Paperclip size={14} />
                  </div>
              )}
              <span className="text-gray-400">{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
      </div>
    </div>
  );
};

