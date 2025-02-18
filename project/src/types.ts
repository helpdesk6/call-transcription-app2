export interface TranscriptionConfig {
  apiKey: string;
  serverUrl: string;
  useLocalServer: boolean;
  watchInterval: number;
  analysisConfig: AnalysisConfig;
}

export interface AnalysisConfig {
  enabled: boolean;
  useLocalModel: boolean;
  localModelUrl: string;
  openAiModel: string;
  apiKey?: string;
}

export interface AudioFile {
  id: string;
  name: string;
  path: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  language?: string;
  transcription?: string;
  error?: string;
  progress: number;
  processingTime?: number;
  createdAt: Date;
  duration?: number;
  analysis?: Analysis;
  analysisType?: 'openai' | 'local';
  duplicateOf?: string;
}

export interface Analysis {
  problems: string[];
  solutions: string[];
  temperature: number;
  summary: string;
}

export interface TranscriptionStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
}

export interface TranscriptionLog {
  id: string;
  fileId: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  createdAt: Date;
}

export type TabId = 'queue' | 'completed' | 'stats' | 'settings';