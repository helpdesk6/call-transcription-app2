import { supabase } from './supabase';
import type { AudioFile, Analysis, AnalysisConfig } from '../types';

export async function analyzeTranscription(
  file: AudioFile,
  config: AnalysisConfig
): Promise<Analysis | null> {
  if (!config.enabled || !file.transcription) {
    return null;
  }

  // Check for required configuration
  if (!config.useLocalModel && !config.apiKey) {
    throw new Error('OpenAI API key is required for analysis when not using local model');
  }

  if (config.useLocalModel && !config.localModelUrl) {
    throw new Error('Local model URL is required when using local model');
  }

  const prompt = `Проаналізуй наступну транскрипцію розмови та надай структурований аналіз.

Вимоги до аналізу:

1. ПРОБЛЕМИ:
   - Виділи конкретні проблеми, про які йдеться в розмові
   - Кожна проблема має бути чітко сформульована
   - Уникай загальних формулювань
   - Якщо проблема складна, розбий її на конкретні аспекти

2. РІШЕННЯ:
   - Для кожної виявленої проблеми вкажи конкретне рішення
   - Рішення мають бути практичними та здійсненними
   - Вказуй конкретні кроки або дії
   - Якщо рішення не було запропоновано в розмові, не вигадуй його

3. ТЕМПЕРАТУРА РОЗМОВИ (оцінка від 1 до 10):
   Критерії оцінки:
   - 1-3: Холодна, формальна, можливо конфліктна розмова
   - 4-6: Нейтральна, робоча розмова
   - 7-8: Тепла, дружня розмова
   - 9-10: Дуже тепла, емоційно позитивна розмова

   Враховуй:
   - Тон спілкування
   - Використання ввічливих слів
   - Емоційне забарвлення
   - Готовність до співпраці
   - Вирішення конфліктних моментів

4. КОРОТКИЙ ЗМІСТ:
   - Стисло опиши основну суть розмови (2-3 речення)
   - Вкажи ключові результати або домовленості
   - Підсумуй загальний результат розмови

Транскрипція розмови:
${file.transcription}

Надай аналіз у такому форматі:
ПРОБЛЕМИ:
1. [Проблема 1]
2. [Проблема 2]
...

РІШЕННЯ:
1. [Рішення 1]
2. [Рішення 2]
...

ТЕМПЕРАТУРА РОЗМОВИ: [Число]/10
[Обґрунтування оцінки]

КОРОТКИЙ ЗМІСТ:
[Текст]`;

  try {
    let response;

    if (config.useLocalModel) {
      response = await fetch(`${config.localModelUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral',
          prompt,
          stream: false,
          temperature: 0.3 // Нижча температура для більш консистентних результатів
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get response from local model: ${errorText}`);
      }

      const data = await response.json();
      const text = data.response;

      const analysis = parseAnalysisResponse(text);
      await updateFileAnalysis(file.id, analysis, 'local');
      return analysis;
    } else {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required for analysis');
      }

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.openAiModel,
          messages: [{
            role: 'system',
            content: 'Ти - експерт з аналізу розмов. Твоє завдання - надавати структурований та детальний аналіз транскрибованих розмов, фокусуючись на проблемах, рішеннях та загальній атмосфері спілкування.'
          }, {
            role: 'user',
            content: prompt
          }],
          temperature: 0.3 // Нижча температура для більш консистентних результатів
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content;

      const analysis = parseAnalysisResponse(text);
      await updateFileAnalysis(file.id, analysis, 'openai');
      return analysis;
    }
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

function parseAnalysisResponse(text: string): Analysis {
  const problems: string[] = [];
  const solutions: string[] = [];
  let temperature = 5;
  let summary = '';
  let temperatureJustification = '';

  const sections = text.split(/\n\n+/);
  let currentSection = '';

  for (const section of sections) {
    const lines = section.split('\n');
    const sectionHeader = lines[0].toLowerCase().trim();

    if (sectionHeader.includes('проблем')) {
      currentSection = 'problems';
      lines.slice(1).forEach(line => {
        const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
        if (cleaned && !cleaned.toLowerCase().includes('проблем')) {
          problems.push(cleaned);
        }
      });
    } else if (sectionHeader.includes('рішен')) {
      currentSection = 'solutions';
      lines.slice(1).forEach(line => {
        const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
        if (cleaned && !cleaned.toLowerCase().includes('рішен')) {
          solutions.push(cleaned);
        }
      });
    } else if (sectionHeader.includes('температур')) {
      const tempMatch = section.match(/\d+/);
      if (tempMatch) {
        temperature = parseInt(tempMatch[0], 10);
        // Зберігаємо обґрунтування температури
        temperatureJustification = lines.slice(1).join(' ').trim();
      }
    } else if (sectionHeader.includes('короткий зміст') || sectionHeader.includes('підсум')) {
      summary = lines.slice(1).join(' ').trim();
    }
  }

  // Додаємо обґрунтування температури до підсумку
  if (temperatureJustification) {
    summary = `${summary}\n\nОцінка температури розмови (${temperature}/10): ${temperatureJustification}`;
  }

  return {
    problems: problems.filter(p => p.length > 0),
    solutions: solutions.filter(s => s.length > 0),
    temperature,
    summary: summary.trim()
  };
}

async function updateFileAnalysis(
  fileId: string,
  analysis: Analysis,
  analysisType: 'openai' | 'local'
): Promise<void> {
  const { error } = await supabase
    .from('transcription_files')
    .update({
      analysis,
      analysis_type: analysisType,
      updated_at: new Date().toISOString()
    })
    .eq('id', fileId);

  if (error) {
    console.error('Failed to update file analysis:', error);
    throw error;
  }
}

export async function analyzeSelectedFiles(
  files: AudioFile[],
  config: AnalysisConfig
): Promise<void> {
  for (const file of files) {
    try {
      const analysis = await analyzeTranscription(file, config);
      if (analysis) {
        console.log(`Analysis completed for file: ${file.name}`);
      }
    } catch (error) {
      console.error(`Failed to analyze file ${file.name}:`, error);
      throw error;
    }
  }
}