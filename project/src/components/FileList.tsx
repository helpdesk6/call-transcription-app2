import React, { useState } from 'react';
import { FileAudio, Check, X, Clock, Loader, ChevronDown, ChevronRight, RefreshCw, Thermometer } from 'lucide-react';
import type { AudioFile, AnalysisType } from '../types';
import { analyzeSelectedFiles } from '../lib/analysis';

interface FileListProps {
  files: AudioFile[];
  onRemove: (id: string) => void;
  showAnalysisControls?: boolean;
  config?: {
    enabled: boolean;
    useLocalModel: boolean;
    localModelUrl: string;
    openAiModel: string;
    analysisType: AnalysisType;
  };
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onSearch?: (search: string) => void;
}

export function FileList({ 
  files, 
  onRemove, 
  showAnalysisControls = false, 
  config,
  pagination,
  onSearch
}: FileListProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const toggleTranscription = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const toggleAllFiles = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const handleAnalyzeSelected = async () => {
    if (!config) return;

    setIsAnalyzing(true);
    try {
      const selectedFileObjects = files.filter(f => selectedFiles.has(f.id));
      await analyzeSelectedFiles(selectedFileObjects, {
        ...config,
        enabled: true
      });
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusIcon = (status: AudioFile['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTemperatureColor = (temperature: number) => {
    if (temperature >= 7) return 'text-green-500';
    if (temperature <= 4) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getTemperatureBackground = (temperature: number) => {
    if (temperature >= 7) return 'bg-green-50 dark:bg-green-900/20';
    if (temperature <= 4) return 'bg-red-50 dark:bg-red-900/20';
    return 'bg-yellow-50 dark:bg-yellow-900/20';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('uk-UA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Файли для обробки</h2>
        <div className="flex items-center gap-4">
          {onSearch && (
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Пошук..."
              className="px-4 py-2 border rounded-md"
            />
          )}
          {showAnalysisControls && files.length > 0 && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === files.length}
                  onChange={toggleAllFiles}
                  className="rounded border-gray-300"
                />
                Вибрати всі
              </label>
              <button
                onClick={handleAnalyzeSelected}
                disabled={selectedFiles.size === 0 || isAnalyzing}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-white
                  ${selectedFiles.size === 0 || isAnalyzing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'}
                `}
              >
                {isAnalyzing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Аналізувати вибрані
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        {files.map((file) => (
          <div
            key={file.id}
            className={`
              border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden
              ${file.analysis?.temperature !== undefined ? getTemperatureBackground(file.analysis.temperature) : ''}
            `}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 flex-grow">
                {showAnalysisControls && (
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className="rounded border-gray-300"
                  />
                )}
                <FileAudio className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{file.name}</p>
                    {getStatusIcon(file.status)}
                    {file.analysis?.temperature !== undefined && (
                      <div className={`flex items-center gap-1 ${getTemperatureColor(file.analysis.temperature)}`}>
                        <Thermometer className="w-4 h-4" />
                        <span className="font-medium">{file.analysis.temperature}/10</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(file.createdAt)}
                    {file.language && ` • Мова: ${file.language}`}
                    {file.processingTime && ` • Час обробки: ${file.processingTime.toFixed(1)}с`}
                    {` • ${(file.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {file.status === 'processing' && (
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
                
                {(file.status === 'completed' && (file.transcription || file.analysis)) && (
                  <button
                    onClick={() => toggleTranscription(file.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  >
                    {expandedFiles.has(file.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => onRemove(file.id)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {file.status === 'completed' && 
             expandedFiles.has(file.id) && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {file.transcription && (
                  <>
                    <h4 className="font-medium mb-2">Транскрибація:</h4>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-4">
                      {file.transcription}
                    </p>
                  </>
                )}
                
                {file.analysis && (
                  <>
                    <h4 className="font-medium mb-2">Аналіз:</h4>
                    <div className="space-y-2 text-gray-700 dark:text-gray-300">
                      {file.analysis.problems.length > 0 && (
                        <div>
                          <p className="font-medium">Проблеми:</p>
                          <ul className="list-disc list-inside pl-4">
                            {file.analysis.problems.map((problem, index) => (
                              <li key={index}>{problem}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {file.analysis.solutions.length > 0 && (
                        <div>
                          <p className="font-medium">Рішення:</p>
                          <ul className="list-disc list-inside pl-4">
                            {file.analysis.solutions.map((solution, index) => (
                              <li key={index}>{solution}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div>
                        <p className="font-medium">Температура розмови: {file.analysis.temperature}/10</p>
                      </div>
                      
                      {file.analysis.summary && (
                        <div>
                          <p className="font-medium">Короткий зміст:</p>
                          <p>{file.analysis.summary}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        
        {files.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Немає файлів для відображення
          </div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
            className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-700 disabled:opacity-50"
          >
            Попередня
          </button>
          <span className="px-4 py-2">
            Сторінка {pagination.currentPage} з {pagination.totalPages}
          </span>
          <button
            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
            className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-700 disabled:opacity-50"
          >
            Наступна
          </button>
        </div>
      )}
    </div>
  );
}