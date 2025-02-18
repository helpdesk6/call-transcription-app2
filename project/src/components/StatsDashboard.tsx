import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle, XCircle, Activity, Timer, BarChart3, Calendar, ChevronRight } from 'lucide-react';
import type { TranscriptionStats, AudioFile } from '../types';

interface StatsDashboardProps {
  stats: TranscriptionStats;
  files?: AudioFile[];
}

type TimeRange = 'day' | 'month' | 'all';
type TemperatureRange = 'all' | 'low' | 'medium' | 'high';

export function StatsDashboard({ stats, files = [] }: StatsDashboardProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('day');
  const [selectedTemperatureRange, setSelectedTemperatureRange] = useState<TemperatureRange>('all');
  const [showDetails, setShowDetails] = useState(false);

  const totalFiles = stats.pending + stats.processing + stats.completed + stats.failed;
  
  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '0с';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}год`);
    if (minutes > 0) parts.push(`${minutes}хв`);
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}с`);
    
    return parts.join(' ');
  };

  const calculateSuccessRate = () => {
    if (stats.completed + stats.failed === 0) return 0;
    return (stats.completed / (stats.completed + stats.failed)) * 100;
  };

  const getTemperatureColor = (temp: number) => {
    if (temp >= 7) return 'text-green-600 dark:text-green-400';
    if (temp <= 4) return 'text-red-600 dark:text-red-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  const getTemperatureBackground = (temp: number) => {
    if (temp >= 7) return 'bg-green-50 dark:bg-green-900/20';
    if (temp <= 4) return 'bg-red-50 dark:bg-red-900/20';
    return 'bg-yellow-50 dark:bg-yellow-900/20';
  };

  const temperatureStats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const getTimeRangeFiles = (range: TimeRange) => {
      return files.filter(file => {
        const fileDate = new Date(file.createdAt);
        switch (range) {
          case 'day':
            return fileDate >= startOfDay;
          case 'month':
            return fileDate >= startOfMonth;
          default:
            return true;
        }
      });
    };

    const rangeFiles = getTimeRangeFiles(selectedTimeRange);
    const filesWithTemperature = rangeFiles.filter(f => f.analysis?.temperature !== undefined);
    
    if (filesWithTemperature.length === 0) {
      return {
        average: 0,
        low: 0,
        medium: 0,
        high: 0,
        total: 0,
        filteredFiles: []
      };
    }

    const sum = filesWithTemperature.reduce((acc, file) => acc + (file.analysis?.temperature || 0), 0);
    const average = sum / filesWithTemperature.length;

    const lowTemp = filesWithTemperature.filter(f => (f.analysis?.temperature || 0) <= 4);
    const mediumTemp = filesWithTemperature.filter(f => {
      const temp = f.analysis?.temperature || 0;
      return temp > 4 && temp < 7;
    });
    const highTemp = filesWithTemperature.filter(f => (f.analysis?.temperature || 0) >= 7);

    let filteredFiles = filesWithTemperature;
    if (selectedTemperatureRange !== 'all') {
      switch (selectedTemperatureRange) {
        case 'low':
          filteredFiles = lowTemp;
          break;
        case 'medium':
          filteredFiles = mediumTemp;
          break;
        case 'high':
          filteredFiles = highTemp;
          break;
      }
    }

    return {
      average,
      low: lowTemp.length,
      medium: mediumTemp.length,
      high: highTemp.length,
      total: filesWithTemperature.length,
      filteredFiles
    };
  }, [files, selectedTimeRange, selectedTemperatureRange]);

  return (
    <div className="space-y-6">
      {/* Загальна статистика */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Загальна статистика</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-transform hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="font-medium">В очікуванні</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{stats.pending}</p>
              <p className="text-sm text-gray-500 mb-1">
                {totalFiles > 0 ? `${((stats.pending / totalFiles) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>

          <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg transition-transform hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">В обробці</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{stats.processing}</p>
              <p className="text-sm text-gray-500 mb-1">
                {totalFiles > 0 ? `${((stats.processing / totalFiles) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>

          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg transition-transform hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium">Завершено</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{stats.completed}</p>
              <p className="text-sm text-gray-500 mb-1">
                {totalFiles > 0 ? `${((stats.completed / totalFiles) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>

          <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg transition-transform hover:scale-105">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="font-medium">Помилки</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{stats.failed}</p>
              <p className="text-sm text-gray-500 mb-1">
                {totalFiles > 0 ? `${((stats.failed / totalFiles) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Аналіз температури розмов */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold">Аналіз температури розмов</h2>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as TimeRange)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            >
              <option value="day">За день</option>
              <option value="month">За місяць</option>
              <option value="all">За весь час</option>
            </select>
            <select
              value={selectedTemperatureRange}
              onChange={(e) => setSelectedTemperatureRange(e.target.value as TemperatureRange)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            >
              <option value="all">Всі розмови</option>
              <option value="low">Проблемні (≤4)</option>
              <option value="medium">Нейтральні (5-6)</option>
              <option value="high">Позитивні (≥7)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`p-6 rounded-lg transition-transform hover:scale-105 ${getTemperatureBackground(temperatureStats.average)}`}>
            <p className="text-sm font-medium mb-2">Середня температура</p>
            <p className={`text-3xl font-bold ${getTemperatureColor(temperatureStats.average)}`}>
              {temperatureStats.average.toFixed(1)}/10
            </p>
          </div>

          <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg transition-transform hover:scale-105">
            <p className="text-sm font-medium mb-2">Проблемні розмови</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {temperatureStats.low}
              <span className="text-sm text-gray-500 ml-2">
                {temperatureStats.total > 0 ? `${((temperatureStats.low / temperatureStats.total) * 100).toFixed(1)}%` : '0%'}
              </span>
            </p>
          </div>

          <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg transition-transform hover:scale-105">
            <p className="text-sm font-medium mb-2">Нейтральні розмови</p>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {temperatureStats.medium}
              <span className="text-sm text-gray-500 ml-2">
                {temperatureStats.total > 0 ? `${((temperatureStats.medium / temperatureStats.total) * 100).toFixed(1)}%` : '0%'}
              </span>
            </p>
          </div>

          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg transition-transform hover:scale-105">
            <p className="text-sm font-medium mb-2">Позитивні розмови</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {temperatureStats.high}
              <span className="text-sm text-gray-500 ml-2">
                {temperatureStats.total > 0 ? `${((temperatureStats.high / temperatureStats.total) * 100).toFixed(1)}%` : '0%'}
              </span>
            </p>
          </div>
        </div>

        {/* Список відфільтрованих файлів */}
        {temperatureStats.filteredFiles.length > 0 && (
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 mb-4 text-blue-500 hover:text-blue-600"
            >
              <ChevronRight className={`w-4 h-4 transform transition-transform ${showDetails ? 'rotate-90' : ''}`} />
              {showDetails ? 'Приховати деталі' : 'Показати деталі'}
            </button>

            {showDetails && (
              <div className="space-y-2">
                {temperatureStats.filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`p-4 rounded-lg ${getTemperatureBackground(file.analysis?.temperature || 0)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(file.createdAt).toLocaleString('uk-UA')}
                        </p>
                      </div>
                      <div className={`flex items-center gap-2 ${getTemperatureColor(file.analysis?.temperature || 0)}`}>
                        <span className="font-bold">{file.analysis?.temperature}/10</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ефективність */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Timer className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold">Час обробки</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                {formatTime(stats.averageProcessingTime)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Середній час обробки файлу
              </p>
            </div>
            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {formatTime(stats.totalProcessingTime)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Загальний час обробки
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold">Ефективність</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                {calculateSuccessRate().toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Успішність обробки
              </p>
            </div>
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {totalFiles}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Всього файлів оброблено
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}