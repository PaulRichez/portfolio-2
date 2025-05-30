export interface Coding {
  id?: number;
  name: string;
  icon: string;
  level: 'beginner' | 'Intermediate' | 'advanced' | 'expert';
  category: 'frontend_languages' | 'frontend_frameworks' | 'backend' | 'databases' | 'devops_tools' | 'tools' | 'other_languages';
}
