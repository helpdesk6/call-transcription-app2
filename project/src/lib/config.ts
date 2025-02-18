import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TranscriptionConfig } from '../types';

interface ConfigStore {
  config: TranscriptionConfig;
  setConfig: (config: TranscriptionConfig) => void;
}

export const useConfig = create<ConfigStore>()(
  persist(
    (set) => ({
      config: {
        apiKey: '',
        serverUrl: 'https://api.openai.com/v1/audio/transcriptions',
        useLocalServer: false,
        watchInterval: 5000,
        analysisConfig: {
          enabled: false,
          useLocalModel: false,
          localModelUrl: 'http://ollama:11434',
          openAiModel: 'gpt-4',
          analysisType: 'problems-solutions',
          apiKey: ''
        }
      },
      setConfig: (config) => set({ config }),
    }),
    {
      name: 'transcription-config',
    }
  )
);