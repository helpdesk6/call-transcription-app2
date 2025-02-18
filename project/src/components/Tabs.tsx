import React from 'react';
import type { TabId } from '../types';
import { Settings, ListTodo, CheckSquare, BarChart3 } from 'lucide-react';

interface TabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function Tabs({ activeTab, onTabChange }: TabsProps) {
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'settings', label: 'Налаштування', icon: <Settings className="w-4 h-4" /> },
    { id: 'queue', label: 'Черга', icon: <ListTodo className="w-4 h-4" /> },
    { id: 'completed', label: 'Завершені', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'stats', label: 'Статистика', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="flex space-x-4" aria-label="Tabs">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium
              ${activeTab === id
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}