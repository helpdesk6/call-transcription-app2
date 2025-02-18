import React from 'react';
import type { TranscriptionLog } from '../types';
import { AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface LogViewerProps {
  logs: TranscriptionLog[];
}

export function LogViewer({ logs }: LogViewerProps) {
  const getIcon = (level: TranscriptionLog['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mt-4">
      <h3 className="text-lg font-medium mb-4">Журнал подій</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`
              flex items-start gap-2 p-2 rounded-md
              ${log.level === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                log.level === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                'bg-blue-50 dark:bg-blue-900/20'}
            `}
          >
            {getIcon(log.level)}
            <div>
              <p className="text-sm">{log.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}