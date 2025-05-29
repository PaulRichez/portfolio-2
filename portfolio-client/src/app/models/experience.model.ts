export interface Experience {
  id?: number;
  title: string;
  business: string;
  businessWebsite?: string;
  descriptions?: string[] | any; // Can be JSON array
  startDate: string; // ISO date string
  endDate?: string | null; // ISO date string or null for current job
}
