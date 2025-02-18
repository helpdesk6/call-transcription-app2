import type { AudioFile } from '../types';

export async function exportToExcel(files: AudioFile[]): Promise<void> {
  const XLSX = await import('xlsx');
  
  const data = files.map(file => ({
    'Назва файлу': file.name,
    'Тривалість дзвінка': file.duration ? `${Math.floor(file.duration / 60)}:${(file.duration % 60).toString().padStart(2, '0')}` : 'Невідомо',
    'Дата транскрибації': new Date(file.createdAt).toLocaleString('uk-UA'),
    'Транскрибація': file.transcription || '',
    'Аналіз дзвінка': file.analysis ? [
      'Проблеми:',
      ...file.analysis.problems.map(p => `- ${p}`),
      '',
      'Рішення:',
      ...file.analysis.solutions.map(s => `- ${s}`),
      '',
      `Температура розмови: ${file.analysis.temperature}/10`,
      '',
      'Короткий зміст:',
      file.analysis.summary
    ].join('\n') : 'Аналіз відсутній'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Транскрибації');
  
  // Автоматично налаштовуємо ширину колонок
  const maxWidth = Object.keys(data[0]).reduce((acc, key) => {
    const maxLength = Math.max(
      key.length,
      ...data.map(row => String(row[key as keyof typeof row]).length)
    );
    acc[key] = Math.min(maxLength, 100); // Обмежуємо максимальну ширину
    return acc;
  }, {} as Record<string, number>);

  worksheet['!cols'] = Object.values(maxWidth).map(width => ({ width }));

  XLSX.writeFile(workbook, 'transcriptions.xlsx');
}