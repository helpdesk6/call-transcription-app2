import React, { useState, useEffect, useRef } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { FileList } from './components/FileList';
import { StatsDashboard } from './components/StatsDashboard';
import { Tabs } from './components/Tabs';
import { LogViewer } from './components/LogViewer';
import { ThemeToggle } from './components/ThemeToggle';
import { supabase, ensureAuth } from './lib/supabase';
import { transcribeAudio } from './lib/transcription';
import { useConfig } from './lib/config';
import type { AudioFile, TranscriptionStats, TranscriptionLog, TabId } from './types';
import { Upload, Folder, FileAudio } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { syncExternalCalls, getExternalCalls } from './lib/externalDatabase';

function App() {
  const { config, setConfig } = useConfig();
  const [activeTab, setActiveTab] = useState<TabId>('queue');
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [logs, setLogs] = useState<TranscriptionLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileDataMap = useRef<Map<string, File>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 25;

  const [stats, setStats] = useState<TranscriptionStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0
  });

  useEffect(() => {
    setConfig({
      ...config,
      analysisConfig: {
        ...config.analysisConfig,
        apiKey: config.apiKey
      }
    });
  }, [config.apiKey]);

  useEffect(() => {
    ensureAuth();
  }, []);

  // Синхронізація з зовнішньою базою
  useEffect(() => {
    const syncData = async () => {
      try {
        await syncExternalCalls(10000); // 10 секунд таймаут
        const { data, total } = await getExternalCalls(currentPage, pageSize, searchQuery);
        
        if (data.length > 0) {
          setFiles(prevFiles => {
            const newFiles = [...prevFiles];
            for (const file of data) {
              const index = newFiles.findIndex(f => f.id === file.id);
              if (index === -1) {
                newFiles.push(file);
              } else {
                newFiles[index] = file;
              }
            }
            return newFiles;
          });
          setTotalPages(Math.ceil(total / pageSize));
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Sync failed:', error);
        }
      }
    };

    // Початкова синхронізація
    syncData();

    // Періодична синхронізація
    const syncInterval = setInterval(syncData, 60000); // кожну хвилину

    return () => clearInterval(syncInterval);
  }, [currentPage, searchQuery]);

  const fetchFiles = async () => {
    await ensureAuth();
    const { data: files } = await supabase
      .from('transcription_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (files) {
      setFiles(files.map(f => ({
        ...f,
        createdAt: new Date(f.created_at),
      })));
    }
  };

  const fetchLogs = async () => {
    await ensureAuth();
    const { data: logs } = await supabase
      .from('transcription_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (logs) {
      setLogs(logs.map(l => ({
        ...l,
        createdAt: new Date(l.created_at),
      })));
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchLogs();

    const filesChannel = supabase
      .channel('files-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transcription_files'
        },
        (payload) => {
          console.log('Files change received:', payload);
          fetchFiles();
        }
      )
      .subscribe((status) => {
        console.log('Files subscription status:', status);
      });

    const logsChannel = supabase
      .channel('logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transcription_logs'
        },
        (payload) => {
          console.log('Logs change received:', payload);
          fetchLogs();
        }
      )
      .subscribe((status) => {
        console.log('Logs subscription status:', status);
      });

    const filesInterval = setInterval(fetchFiles, 5000);
    const logsInterval = setInterval(fetchLogs, 5000);

    return () => {
      filesChannel.unsubscribe();
      logsChannel.unsubscribe();
      clearInterval(filesInterval);
      clearInterval(logsInterval);
      fileDataMap.current.clear();
    };
  }, []);

  useEffect(() => {
    const calculateStats = () => {
      const pending = files.filter(f => f.status === 'pending').length;
      const processing = files.filter(f => f.status === 'processing').length;
      const completed = files.filter(f => f.status === 'completed').length;
      const failed = files.filter(f => f.status === 'failed').length;

      const completedFiles = files.filter(f => f.status === 'completed' && f.processingTime);
      const totalTime = completedFiles.reduce((acc, f) => acc + (f.processingTime || 0), 0);
      const avgTime = completedFiles.length ? totalTime / completedFiles.length : 0;

      setStats({
        pending,
        processing,
        completed,
        failed,
        averageProcessingTime: avgTime,
        totalProcessingTime: totalTime
      });
    };

    calculateStats();
  }, [files]);

  const checkDuplicateFile = async (fileName: string) => {
    const { data: existingFiles } = await supabase
      .from('transcription_files')
      .select('id, name, status')
      .eq('name', fileName)
      .not('status', 'eq', 'failed');

    return existingFiles && existingFiles.length > 0 ? existingFiles[0] : null;
  };

  const processAudioFiles = async (audioFiles: File[]) => {
    try {
      await ensureAuth();

      if (!config.apiKey && !config.useLocalServer) {
        toast.error('Будь ласка, налаштуйте API ключ або локальний сервер перед завантаженням файлів');
        setActiveTab('settings');
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      
      for (const file of audioFiles) {
        try {
          if (!file.type.startsWith('audio/')) {
            toast.error(`Невірний тип файлу для ${file.name}`);
            errorCount++;
            continue;
          }

          const existingFile = await checkDuplicateFile(file.name);
          if (existingFile) {
            toast.error(`Файл ${file.name} вже існує`);
            errorCount++;
            continue;
          }

          const { data, error } = await supabase
            .from('transcription_files')
            .insert({
              name: file.name,
              path: 'pending',
              size: file.size,
              status: 'pending',
              progress: 0,
              user_id: (await supabase.auth.getUser()).data.user?.id
            })
            .select()
            .single();

          if (error) {
            toast.error(`Помилка при додаванні файлу: ${error.message}`);
            errorCount++;
            continue;
          }

          if (!data) {
            throw new Error('No data returned from insert');
          }

          fileDataMap.current.set(data.id, file);

          toast.loading(`Початок транскрибації файлу: ${file.name}`, {
            id: `transcription-${data.id}`
          });

          try {
            await transcribeAudio({
              ...data,
              createdAt: new Date(data.created_at),
              fileData: file
            }, config);
            
            toast.success(`Транскрибація завершена: ${file.name}`, {
              id: `transcription-${data.id}`
            });
            successCount++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Невідома помилка';
            toast.error(`Помилка транскрибації: ${errorMessage}`, {
              id: `transcription-${data.id}`
            });
            errorCount++;
            throw error;
          } finally {
            fileDataMap.current.delete(data.id);
          }
        } catch (error) {
          console.error('Error processing file:', error);
          errorCount++;
        }
      }

      if (successCount > 0 || errorCount > 0) {
        const message = [];
        if (successCount > 0) message.push(`Успішно оброблено: ${successCount}`);
        if (errorCount > 0) message.push(`Помилок: ${errorCount}`);
        toast(message.join(', '), {
          icon: successCount > 0 ? '✅' : '❌',
        });
      }
    } catch (error) {
      console.error('Error in processAudioFiles:', error);
      toast.error('Помилка при обробці файлів');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (!config.apiKey && !config.useLocalServer) {
      toast.error('Будь ласка, налаштуйте API ключ або локальний сервер перед завантаженням файлів');
      setActiveTab('settings');
      return;
    }

    const selectedFiles = Array.from(e.target.files || []);
    const audioFiles = selectedFiles.filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length === 0) {
      toast.error('Будь ласка, виберіть аудіо файли (WAV або MP3)');
      return;
    }

    try {
      await processAudioFiles(audioFiles);
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Помилка при обробці файлів. Будь ласка, перевірте налаштування та спробуйте ще раз.');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (!config.apiKey && !config.useLocalServer) {
      toast.error('Будь ласка, налаштуйте API ключ або локальний сервер перед завантаженням файлів');
      setActiveTab('settings');
      return;
    }

    const selectedFiles = Array.from(e.target.files || []);
    const audioFiles = selectedFiles.filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length === 0) {
      toast.error('Будь ласка, виберіть папку з аудіо файлами (WAV або MP3)');
      return;
    }

    toast(`Знайдено ${audioFiles.length} аудіо файлів з ${selectedFiles.length} файлів`);

    try {
      await processAudioFiles(audioFiles);
    } catch (error) {
      console.error('Error processing folder:', error);
      toast.error('Помилка при обробці файлів. Будь ласка, перевірте налаштування та спробуйте ще раз.');
    }
    
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const removeFile = async (id: string) => {
    try {
      await ensureAuth();
      
      fileDataMap.current.delete(id);

      const { error } = await supabase
        .from('transcription_files')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Помилка при видаленні файлу');
        console.error('Error removing file:', error);
      } else {
        toast.success('Файл успішно видалено');
      }
    } catch (error) {
      toast.error('Помилка при видаленні файлу');
      console.error('Error removing file:', error);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'queue':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-12 h-12 text-blue-500 mb-4" />
                <p className="text-lg font-medium mb-4">
                  Виберіть аудіо файли для транскрибації
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    <FileAudio className="w-4 h-4" />
                    Вибрати файли
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                  >
                    <Folder className="w-4 h-4" />
                    Вибрати папку
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  webkitdirectory=""
                  directory=""
                  className="hidden"
                  onChange={handleFolderSelect}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Підтримуються формати WAV та MP3
                </p>
              </div>
            </div>
            <FileList
              files={files.filter(f => ['pending', 'processing'].includes(f.status))}
              onRemove={removeFile}
            />
          </div>
        );
      case 'completed':
        return (
          <FileList
            files={files.filter(f => ['completed', 'failed'].includes(f.status))}
            onRemove={removeFile}
            showAnalysisControls={true}
            config={config.analysisConfig}
            pagination={{
              currentPage,
              totalPages,
              onPageChange: setCurrentPage
            }}
            onSearch={setSearchQuery}
          />
        );
      case 'stats':
        return <StatsDashboard stats={stats} files={files} />;
      case 'settings':
        return (
          <div className="space-y-6">
            <ConfigPanel config={config} onConfigChange={setConfig} />
            <LogViewer logs={logs} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
          <ThemeToggle />
        </div>
        <div className="mt-6">
          {renderContent()}
        </div>
      </div>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;