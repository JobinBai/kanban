import React, { useState, useEffect, useRef } from 'react';
import { X, Flag, Paperclip, Trash2, File as FileIcon, Download, Eye } from 'lucide-react';
import { Task, Priority, useTaskStore } from '../store/taskStore';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, priority: Priority, files: File[]) => void;
  initialData?: Task | null;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(3);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  const { attachments, fetchAttachments, uploadAttachment, deleteAttachment } = useTaskStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const getPriorityBgColor = (p: number) => {
      switch (p) {
          case 1: return 'bg-green-50 text-green-600 ring-green-500';
          case 2: return 'bg-blue-50 text-blue-600 ring-blue-500';
          case 3: return 'bg-yellow-50 text-yellow-600 ring-yellow-500';
          case 4: return 'bg-orange-50 text-orange-600 ring-orange-500';
          case 5: return 'bg-red-50 text-red-600 ring-red-500';
          default: return 'bg-gray-50 text-gray-400';
      }
  };

  const isPreviewable = (fileType: string) => {
      if (!fileType) return false;
      return fileType.startsWith('image/') || 
             fileType === 'application/pdf' || 
             fileType.startsWith('text/') || 
             fileType.startsWith('audio/') || 
             fileType.startsWith('video/');
  };

  // Reset or fill data when opening
  useEffect(() => {
      if (isOpen) {
          if (initialData) {
              setTitle(initialData.title);
              setDescription(initialData.description);
              setPriority(initialData.priority);
              fetchAttachments(initialData.id);
          } else {
              setTitle('');
              setDescription('');
              setPriority(3);
              setPendingFiles([]);
          }
      }
  }, [isOpen, initialData, fetchAttachments]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title, description, priority, pendingFiles);
      // Don't clear state here, let useEffect handle it on next open or close
      onClose();
    }
  };

  const currentAttachments = initialData ? (attachments[initialData.id] || []) : [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        if (initialData) {
            for (const file of files) {
                await uploadAttachment(initialData.id, file);
            }
        } else {
            setPendingFiles(prev => [...prev, ...files]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
            {initialData ? '编辑任务' : '新建任务'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="要做什么？"
              autoFocus
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p as Priority)}
                        className={`p-2 rounded-lg transition-all ${
                            priority === p 
                                ? `${getPriorityBgColor(p)} ring-2 ring-offset-1` 
                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                        }`}
                        title={`Priority ${p}`}
                    >
                        <Flag 
                            size={20} 
                            fill={priority >= p ? "currentColor" : "none"} 
                            className={priority >= p ? getPriorityColor(priority) : ""}
                        />
                    </button>
                ))}
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none transition-all"
              placeholder="添加关于任务的详细信息..."
            />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">附件</label>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                    <Paperclip size={14} /> 添加附件
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                />
            </div>
            
            {/* Create Mode: Show pending files */}
            {!initialData && pendingFiles.length > 0 && (
                <div className="space-y-2 mb-2">
                    {pendingFiles.map((file, index) => (
                        <div key={index} className="p-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileIcon size={16} className="text-blue-500" />
                                <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== index))}
                                className="text-gray-400 hover:text-red-600 p-1"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Mode: Show uploaded attachments */}
            {initialData && (
                <div className="space-y-2">
                    {currentAttachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                {att.file_type.startsWith('image/') ? (
                                    <div className="w-8 h-8 rounded bg-gray-200 flex-shrink-0 overflow-hidden relative group">
                                        <img 
                                            src={`/uploads/${att.file_path}`} 
                                            alt={att.file_name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <FileIcon size={16} className="text-gray-400 flex-shrink-0" />
                                )}
                                <span className="text-sm text-gray-700 truncate max-w-[200px]" title={att.file_name}>
                                    {att.file_name}
                                </span>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                    ({(att.file_size / 1024).toFixed(1)} KB)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {isPreviewable(att.file_type) && (
                                    <a 
                                        href={`/uploads/${att.file_path}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-gray-400 hover:text-blue-600 p-1"
                                        title="预览"
                                    >
                                        <Eye size={14} />
                                    </a>
                                )}
                                <a 
                                    href={`/uploads/${att.file_path}`} 
                                    download={att.file_name}
                                    className="text-gray-400 hover:text-blue-600 p-1"
                                    title="下载"
                                >
                                    <Download size={14} />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => deleteAttachment(att.id, initialData.id)}
                                    className="text-gray-400 hover:text-red-600 p-1"
                                    title="删除"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {currentAttachments.length === 0 && (
                        <div className="text-sm text-gray-400 italic text-center py-2 border border-dashed border-gray-200 rounded-lg">
                            暂无附件
                        </div>
                    )}
                </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-lg shadow-blue-600/20"
            >
              {initialData ? '保存修改' : '创建任务'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
