export interface Coding {
  id?: number;
  name: string;
  icon: string;
  category: 'frontend_languages' | 'frontend_frameworks' | 'backend' | 'databases' | 'devops_tools' | 'tools' | 'other_languages';
}
