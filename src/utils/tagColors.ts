/**
 * tagColors.ts
 * Utilitário para gerar cores estáveis e harmoniosas baseadas no nome da tag.
 * Isso garante que uma tag específica sempre tenha a mesma cor em todo o app.
 */

export interface TagStyle {
  bg: string;
  text: string;
  border: string;
}

const tagPalettes: TagStyle[] = [
  {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20 dark:border-blue-500/30',
  },
  {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
  },
  {
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/20 dark:border-violet-500/30',
  },
  {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20 dark:border-amber-500/30',
  },
  {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20 dark:border-rose-500/30',
  },
  {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/20 dark:border-cyan-500/30',
  },
  {
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/20 dark:border-orange-500/30',
  },
  {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/20 dark:border-indigo-500/30',
  },
  {
    bg: 'bg-teal-500/10 dark:bg-teal-500/20',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-500/20 dark:border-teal-500/30',
  },
  {
    bg: 'bg-pink-500/10 dark:bg-pink-500/20',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-500/20 dark:border-pink-500/30',
  },
];

export function getTagColors(tag: string): TagStyle {
  const cleanTag = tag.trim().toLowerCase();
  
  // Hash simples baseado na soma ponderada dos caracteres
  let hash = 0;
  for (let i = 0; i < cleanTag.length; i++) {
    hash = cleanTag.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % tagPalettes.length;
  return tagPalettes[index];
}
