import React, { useState } from 'react';
import { Plus, Folder, Trash2, FolderPlus, LogOut } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export const ProjectSidebar: React.FC = () => {
  const { projects, currentProjectId, setCurrentProject, addProject, deleteProject } = useTaskStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      addProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个项目吗？所有相关数据将被永久删除。')) {
      deleteProject(id);
    }
  };

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-bold text-gray-700 flex items-center gap-2">
          <Folder size={20} className="text-blue-600" />
          项目列表
        </h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
          title="新建项目"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isCreating && (
          <form onSubmit={handleCreate} className="mb-2 p-2 bg-blue-50 rounded-lg">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="输入项目名称..."
              className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:border-blue-400 mb-2"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                取消
              </button>
              <button 
                type="submit"
                disabled={!newProjectName.trim()}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </form>
        )}

        {projects.length === 0 && !isCreating && (
             <div className="text-center py-8 text-gray-400 text-sm">
                 <FolderPlus size={32} className="mx-auto mb-2 opacity-50" />
                 <p>暂无项目</p>
                 <button onClick={() => setIsCreating(true)} className="text-blue-500 hover:underline mt-1">创建第一个项目</button>
             </div>
        )}

        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => setCurrentProject(project.id)}
            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
              currentProjectId === project.id
                ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="truncate font-medium text-sm">{project.name}</span>
            <button
              onClick={(e) => handleDelete(project.id, e)}
              className={`p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity ${
                  currentProjectId === project.id ? 'opacity-0' : '' // Hide delete on active unless hovered? actually good to show on hover always
              }`}
              title="删除项目"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 mt-auto bg-gray-50">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {user?.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 truncate max-w-[100px]" title={user?.username}>{user?.username}</span>
            </div>
            <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="退出登录"
            >
                <LogOut size={18} />
            </button>
        </div>
      </div>
    </div>
  );
};
