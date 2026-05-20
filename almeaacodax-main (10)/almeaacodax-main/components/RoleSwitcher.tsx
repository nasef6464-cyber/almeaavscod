import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../store/useStore';
import { Role } from '../types';
import { Shield, User, Users, BookOpen, UserCheck, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const RoleSwitcher: React.FC = () => {
  const { user, changeRole } = useStore();
  const { devSwitchRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const roles = [
    { id: Role.ADMIN, label: 'مدير النظام', icon: <Shield size={16} />, path: '/admin-dashboard' },
    { id: Role.SUPERVISOR, label: 'مشرف', icon: <UserCheck size={16} />, path: '/supervisor-dashboard' },
    { id: Role.TEACHER, label: 'معلم', icon: <BookOpen size={16} />, path: '/instructor-dashboard' },
    { id: Role.PARENT, label: 'ولي أمر', icon: <Users size={16} />, path: '/parent-dashboard' },
    { id: Role.STUDENT, label: 'طالب', icon: <User size={16} />, path: '/dashboard' },
  ];

  const handleRoleChange = (roleId: Role, path: string) => {
    if (devSwitchRole) {
      flushSync(() => devSwitchRole(roleId));
    }
    changeRole(roleId);
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div className="fixed left-4 top-24 z-[100]" dir="rtl">
      {isOpen && (
        <div className="absolute left-0 top-12 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl transition-all">
          <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-3">
            <span className="text-xs font-bold text-amber-800">محاكي الأدوار (للتطوير)</span>
          </div>
          <div className="py-2">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleChange(role.id, role.path)}
                data-testid={`dev-role-${role.id}`}
                aria-label={`dev-role-${role.id}`}
                className={`flex w-full items-center gap-3 border-r-4 px-4 py-3 text-right transition-colors ${
                  user.role === role.id
                    ? 'border-amber-500 bg-amber-50 font-bold text-amber-600'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className={user.role === role.id ? 'text-amber-500' : 'text-gray-400'}>
                  {role.icon}
                </div>
                <span className="text-sm">{role.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="dev-role-switcher"
        aria-label="dev-role-switcher"
        className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs shadow-lg transition-all ${
          isOpen ? 'bg-amber-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        <Shield size={16} />
        <span className="text-sm font-medium">تغيير الدور</span>
        <ChevronUp size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
};
