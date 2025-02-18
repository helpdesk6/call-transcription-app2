import React, { useState, useEffect } from 'react';
import { Switch } from '../components/ui/Switch';
import { Settings, Server, AlertCircle, Check, Download, Brain, Database } from 'lucide-react';
import type { TranscriptionConfig } from '../types';
import { exportToExcel } from '../lib/excel';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface ConfigPanelProps {
  config: TranscriptionConfig;
  onConfigChange: (config: TranscriptionConfig) => void;
}

export function ConfigPanel({ config, onConfigChange }: ConfigPanelProps) {
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<'valid' | 'invalid' | 'pending' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isTestingDatabase, setIsTestingDatabase] = useState(false);

  // Ensure analysisConfig exists with default values
  const analysisConfig = config.analysisConfig || {
    enabled: false,
    useLocalModel: false,
    localModelUrl: 'http://ollama:11434',
    openAiModel: 'gpt-4'
  };

  const testDatabaseConnection = async () => {
    setIsTestingDatabase(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-database-connection', {
        body: { timeout: 5000 } // 5 секунд таймаут
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast.success('Підключення до бази даних успішне');
      } else {
        toast.error(`Помилка підключення: ${data.error || 'Невідома помилка'}`);
      }
    } catch (error) {
      console.error('Database test failed:', error);
      toast.error(`Помилка перевірки: ${error.message || 'Невідома помилка'}`);
    } finally {
      setIsTestingDatabase(false);
    }
  };

  // Перевіряємо API ключ при його зміні
  useEffect(() => {
    const validateApiKey = async () => {
      if (!config.apiKey || config.useLocalServer) {
        setKeyValidationStatus(null);
        setValidationError(null);
        return;
      }

      setIsValidatingKey(true);
      setKeyValidationStatus('pending');
      setValidationError(null);

      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const hasWhisper = data.data.some((model: any) => 
            model.id.startsWith('whisper-')
          );

          if (hasWhisper) {
            setKeyValidationStatus('valid');
          } else {
            setKeyValidationStatus('invalid');
            setValidationError('API ключ дійсний, але не має доступу до Whisper API');
          }
        } else {
          setKeyValidationStatus('invalid');
          const data = await response.json();
          setValidationError(data.error?.message || 'Недійсний API ключ');
        }
      } catch (error) {
        setKeyValidationStatus('invalid');
        setValidationError('Помилка перевірки API ключа');
      } finally {
        setIsValidatingKey(false);
      }
    };

    const debounceTimeout = setTimeout(validateApiKey, 500);
    return () => clearTimeout(debounceTimeout);
  }, [config.apiKey, config.useLocalServer]);

  const getKeyValidationIcon = () => {
    if (!config.apiKey || config.useLocalServer) return null;

    switch (keyValidationStatus) {
      case 'valid':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'invalid':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      default:
        return null;
    }
  };

  const handleExport = async () => {
    const { data: files } = await supabase
      .from('transcription_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (files) {
      const processedFiles = files.map(f => ({
        ...f,
        createdAt: new Date(f.created_at)
      }));
      await exportToExcel(processedFiles);
    }
  };

  return (
    <div className="space-y-6">
      {/* Database Connection Settings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Database className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-semibold">Підключення до бази даних</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Статус підключення</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Перевірте з'єднання з базою даних Asterisk
              </p>
            </div>
            <button
              onClick={testDatabaseConnection}
              disabled={isTestingDatabase}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-white
                ${isTestingDatabase ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'}
                transition-colors
              `}
            >
              {isTestingDatabase ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {isTestingDatabase ? 'Перевірка...' : 'Перевірити підключення'}
            </button>
          </div>
        </div>
      </div>

      {/* Transcription Settings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">Налаштування транскрибації</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              API Ключ OpenAI
            </label>
            <div className="relative">
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => onConfigChange({ ...config, apiKey: e.target.value })}
                disabled={config.useLocalServer}
                className={`
                  w-full p-2 pr-10 border rounded-md
                  ${config.useLocalServer ? 'bg-gray-100 text-gray-500' : ''}
                  ${keyValidationStatus === 'invalid' ? 'border-red-500' : ''}
                  ${keyValidationStatus === 'valid' ? 'border-green-500' : ''}
                `}
                placeholder={config.useLocalServer ? 'Локальний сервер активний' : 'sk-...'}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getKeyValidationIcon()}
              </div>
            </div>
            {validationError && !config.useLocalServer && (
              <p className="mt-1 text-sm text-red-500">{validationError}</p>
            )}
            {keyValidationStatus === 'valid' && !config.useLocalServer && (
              <p className="mt-1 text-sm text-green-500">API ключ перевірено успішно</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">URL Локального Сервера</label>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-gray-500" />
              <input
                type="url"
                value={config.serverUrl}
                onChange={(e) => onConfigChange({ ...config, serverUrl: e.target.value })}
                disabled={!config.useLocalServer}
                className={`
                  flex-1 p-2 border rounded-md
                  ${!config.useLocalServer ? 'bg-gray-100 text-gray-500' : ''}
                `}
                placeholder="http://localhost:9000"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <span className="text-sm font-medium">Використовувати локальний сервер</span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Замість OpenAI API використовувати локальний сервер Whisper
              </p>
            </div>
            <Switch
              checked={config.useLocalServer}
              onCheckedChange={(checked) => 
                onConfigChange({ ...config, useLocalServer: checked })}
            />
          </div>
        </div>
      </div>

      {/* Analysis Settings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-semibold">Налаштування аналізу</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <span className="text-sm font-medium">Аналіз транскрибацій</span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Автоматичний аналіз розмов (проблеми, рішення, температура)
              </p>
            </div>
            <Switch
              checked={analysisConfig.enabled}
              onCheckedChange={(checked) => 
                onConfigChange({
                  ...config,
                  analysisConfig: {
                    ...analysisConfig,
                    enabled: checked
                  }
                })}
            />
          </div>

          {analysisConfig.enabled && (
            <>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <span className="text-sm font-medium">Використовувати локальну модель</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Замість OpenAI GPT використовувати локальну модель
                  </p>
                </div>
                <Switch
                  checked={analysisConfig.useLocalModel}
                  onCheckedChange={(checked) => 
                    onConfigChange({
                      ...config,
                      analysisConfig: {
                        ...analysisConfig,
                        useLocalModel: checked
                      }
                    })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  URL Локальної моделі
                </label>
                <input
                  type="url"
                  value={analysisConfig.localModelUrl}
                  onChange={(e) => onConfigChange({
                    ...config,
                    analysisConfig: {
                      ...analysisConfig,
                      localModelUrl: e.target.value
                    }
                  })}
                  disabled={!analysisConfig.useLocalModel}
                  className={`
                    w-full p-2 border rounded-md
                    ${!analysisConfig.useLocalModel ? 'bg-gray-100 text-gray-500' : ''}
                  `}
                  placeholder="http://ollama:11434"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Модель OpenAI
                </label>
                <select
                  value={analysisConfig.openAiModel}
                  onChange={(e) => onConfigChange({
                    ...config,
                    analysisConfig: {
                      ...analysisConfig,
                      openAiModel: e.target.value
                    }
                  })}
                  disabled={analysisConfig.useLocalModel}
                  className={`
                    w-full p-2 border rounded-md
                    ${analysisConfig.useLocalModel ? 'bg-gray-100 text-gray-500' : ''}
                  `}
                >
                  <option value="gpt-4">GPT-4 (Найкраща якість)</option>
                  <option value="gpt-4o-mini">GPT-4o-mini (Оптимальний варіант)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Швидше)</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold">Експорт даних</h2>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Експортувати в Excel
          </button>
        </div>
      </div>
    </div>
  );
}