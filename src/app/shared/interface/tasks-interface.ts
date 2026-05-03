export interface Tasks {
  id: number;
  title: string;
  description: string;
  date: string;
  priority: number;
  member: number[];
  category: number;
  subtasks: Subtask[];
  task_status: string;
  sort_order: number;
}

export interface Subtask {
  id: number;
  title: string;
  done: boolean;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}
