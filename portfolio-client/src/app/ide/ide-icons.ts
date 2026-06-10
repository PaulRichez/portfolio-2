/** Icône codicon + couleur par type de fichier (façon VS Code). */
export function fileIcon(name: string): { icon: string; color: string } {
  if (name.endsWith('.md')) return { icon: 'codicon-markdown', color: '#519aba' };
  if (name.endsWith('.ts')) return { icon: 'codicon-file-code', color: '#3178c6' };
  if (name.endsWith('.json')) return { icon: 'codicon-json', color: '#cbcb41' };
  if (name.endsWith('.pdf')) return { icon: 'codicon-file-pdf', color: '#e05252' };
  if (name.startsWith('.env')) return { icon: 'codicon-gear', color: '#8a8a8a' };
  return { icon: 'codicon-file', color: '#8a8a8a' };
}

export const LANGUAGE_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  typescript: 'TypeScript',
  json: 'JSON',
  dotenv: 'Properties',
  pdf: 'PDF',
  text: 'Texte brut',
};
