import { supabase, logTranscriptionEvent, updateFileStatus, ensureAuth } from './supabase';
import { analyzeTranscription } from './analysis';
import type { TranscriptionConfig, AudioFile, Analysis } from '../types';

// Функція для розділення великого тексту на менші частини
function splitTextForAnalysis(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';
  
  const MAX_CHUNK_SIZE = 16000;
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function mergeAnalysisResults(results: Analysis[]): Promise<Analysis> {
  const merged: Analysis = {
    problems: [],
    solutions: [],
    temperature: 0,
    summary: ''
  };
  
  for (const result of results) {
    merged.problems.push(...result.problems);
    merged.solutions.push(...result.solutions);
  }
  
  merged.problems = Array.from(new Set(merged.problems));
  merged.solutions = Array.from(new Set(merged.solutions));
  
  merged.temperature = Math.round(
    results.reduce((sum, r) => sum + r.temperature, 0) / results.length
  );
  
  merged.summary = results
    .map(r => r.summary)
    .filter(Boolean)
    .join('\n\n');
  
  return merged;
}

function cleanupTranscription(text: string): string {
  // Розбиваємо на речення, зберігаючи роздільники
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  // Функція для обчислення подібності між фразами
  const similarity = (str1: string, str2: string): number => {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(word => words2.includes(word));
    return intersection.length / Math.max(words1.length, words2.length);
  };

  // Функція для очищення окремого речення
  const cleanSentence = (sentence: string): string => {
    // Розбиваємо на слова, зберігаючи пунктуацію
    const words = sentence.match(/\S+/g) || [];
    if (words.length === 0) return sentence;

    const result: string[] = [words[0]]; // Завжди зберігаємо перше слово
    const usedPhrases = new Set<string>();
    
    // Додаємо перше слово до використаних фраз
    usedPhrases.add(words[0].toLowerCase());

    for (let i = 1; i < words.length; i++) {
      let shouldAdd = true;
      
      // Перевіряємо різні довжини фраз (від 1 до 5 слів)
      for (let len = 1; len <= 5 && i + len <= words.length; len++) {
        const currentPhrase = words.slice(i, i + len).join(' ').toLowerCase();
        
        // Перевіряємо на повтори з попередніми фразами
        for (const usedPhrase of usedPhrases) {
          if (similarity(currentPhrase, usedPhrase) > 0.8) {
            shouldAdd = false;
            break;
          }
        }
        
        if (shouldAdd) {
          usedPhrases.add(currentPhrase);
        } else {
          break;
        }
      }
      
      if (shouldAdd) {
        result.push(words[i]);
      }
    }

    return result.join(' ');
  };

  // Очищуємо кожне речення та перевіряємо на повтори між реченнями
  const cleanedSentences: string[] = [];
  const usedSentences = new Set<string>();

  for (const sentence of sentences) {
    const cleaned = cleanSentence(sentence.trim());
    
    // Перевіряємо, чи речення не є дуже схожим на попередні
    let isDuplicate = false;
    for (const used of usedSentences) {
      if (similarity(cleaned.toLowerCase(), used.toLowerCase()) > 0.8) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate && cleaned.length > 0) {
      cleanedSentences.push(cleaned);
      usedSentences.add(cleaned.toLowerCase());
    }
  }

  return cleanedSentences.join(' ').trim();
}

function normalizeTranscription(text: string): string {
  const commonReplacements: Record<string, string> = {
    'да': 'так',
    'нет': 'ні',
    'щас': 'зараз',
    'сейчас': 'зараз',
    'пока': 'поки',
    'спасибо': 'дякую',
    'пожалуйста': 'будь ласка',
    'конечно': 'звичайно',
    'тоже': 'також',
    'вообще': 'взагалі',
    'короче': 'коротше',
    'ладно': 'гаразд',
    'хорошо': 'добре',
    'ого': 'ого-го',
    'ну': 'ну',
    'всё': 'все',
    'что': 'що',
    'если': 'якщо',
    'просто': 'просто',
    'только': 'тільки'
  };

  const preserveCase = (original: string, replacement: string): string => {
    if (original === original.toLowerCase()) return replacement;
    if (original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  };

  let normalizedText = text;
  
  // Замінюємо слова зі збереженням регістру
  for (const [rus, ukr] of Object.entries(commonReplacements)) {
    const regex = new RegExp(`\\b${rus}\\b`, 'gi');
    normalizedText = normalizedText.replace(regex, (match) => preserveCase(match, ukr));
  }

  // Виправляємо типові помилки транскрибації
  normalizedText = normalizedText
    // Видаляємо зайві пробіли
    .replace(/\s+/g, ' ')
    // Виправляємо пробіли перед розділовими знаками
    .replace(/\s+([.,!?])/g, '$1')
    // Нормалізуємо лапки
    .replace(/"+/g, '"')
    // Додаємо пробіл після розділових знаків
    .replace(/([.,!?])([А-ЯЁа-яёA-Za-z])/g, '$1 $2')
    // Видаляємо повторювані розділові знаки
    .replace(/([.,!?])\1+/g, '$1')
    // Видаляємо повторювані слова, що йдуть підряд
    .replace(/\b(\w+)(\s+\1\b)+/g, '$1')
    .trim();

  return normalizedText;
}

export async function transcribeAudio(
  file: AudioFile & { fileData?: File },
  config: TranscriptionConfig
): Promise<void> {
  try {
    await ensureAuth();
    
    if (!file || !file.fileData) {
      throw new Error('Missing file data');
    }

    if (!file.fileData.type.startsWith('audio/')) {
      throw new Error(`Invalid file type: ${file.fileData.type}`);
    }

    if (!config.useLocalServer && !config.apiKey) {
      throw new Error('Please configure API key or local server before uploading files');
    }

    const startTime = Date.now();
    await updateFileStatus(file.id, 'processing', 0);
    await logTranscriptionEvent(file.id, 'info', `Starting transcription for ${file.name}`);

    const formData = new FormData();
    formData.append('file', file.fileData, file.name);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    formData.append('language', 'uk');
    formData.append('temperature', '0.2');
    formData.append('prompt', 'Це розмова українською мовою, можливо з домішками російських слів.');

    const endpoint = config.useLocalServer ? config.serverUrl : 'https://api.openai.com/v1/audio/transcriptions';
    
    await updateFileStatus(file.id, 'processing', 25);
    await logTranscriptionEvent(file.id, 'info', `Uploading file ${file.name} to transcription service...`);
    
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        await logTranscriptionEvent(
          file.id, 
          'warning', 
          `Retrying transcription (attempt ${attempt + 1} of ${maxRetries})`
        );
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json'
        };

        if (!config.useLocalServer) {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeout);
        await updateFileStatus(file.id, 'processing', 75);

        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorMessage;
          } catch {
            try {
              errorMessage = await response.text() || errorMessage;
            } catch {}
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        
        if (!result || typeof result.text !== 'string') {
          throw new Error(`Invalid response format: ${JSON.stringify(result)}`);
        }

        const cleanedText = cleanupTranscription(result.text);
        const normalizedText = normalizeTranscription(cleanedText);
        const processingTime = (Date.now() - startTime) / 1000;
        
        const { error: updateError } = await supabase
          .from('transcription_files')
          .update({
            status: 'completed',
            transcription: normalizedText,
            language: 'uk',
            progress: 100,
            processing_time: processingTime,
            error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', file.id);

        if (updateError) {
          throw new Error(`Failed to update file status: ${updateError.message}`);
        }

        await logTranscriptionEvent(file.id, 'info', 'Transcription completed successfully');

        if (config.analysisConfig.enabled) {
          await logTranscriptionEvent(file.id, 'info', 'Starting automatic analysis...');
          try {
            const textChunks = splitTextForAnalysis(normalizedText);
            const analysisResults = [];
            
            for (let i = 0; i < textChunks.length; i++) {
              await logTranscriptionEvent(
                file.id,
                'info',
                `Analyzing part ${i + 1} of ${textChunks.length}...`
              );
              
              const chunkAnalysis = await analyzeTranscription({
                ...file,
                transcription: textChunks[i]
              }, config.analysisConfig);
              
              if (chunkAnalysis) {
                analysisResults.push(chunkAnalysis);
              }
            }
            
            if (analysisResults.length > 0) {
              const mergedAnalysis = await mergeAnalysisResults(analysisResults);
              
              const { error: analysisError } = await supabase
                .from('transcription_files')
                .update({
                  analysis: mergedAnalysis,
                  analysis_type: config.analysisConfig.useLocalModel ? 'local' : 'openai',
                  updated_at: new Date().toISOString()
                })
                .eq('id', file.id);
              
              if (analysisError) {
                throw analysisError;
              }
            }
            
            await logTranscriptionEvent(file.id, 'info', 'Analysis completed successfully');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during analysis';
            await logTranscriptionEvent(file.id, 'error', `Analysis failed: ${errorMessage}`);
          }
        }

        return;

      } catch (error) {
        clearTimeout(timeout);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Transcription attempt failed:', { error: errorMessage, attempt });
        
        if (error instanceof Error) {
          lastError = error.name === 'AbortError' 
            ? new Error('Transcription request timed out after 5 minutes')
            : error;
        } else {
          lastError = new Error('Unknown error occurred');
        }

        if (attempt === maxRetries - 1) {
          throw lastError;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Transcription error:', { error: errorMessage, file: { id: file.id, name: file.name } });
    
    await updateFileStatus(file.id, 'failed', 0, errorMessage);
    await logTranscriptionEvent(file.id, 'error', errorMessage);
    
    throw error;
  }
}