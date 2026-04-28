export interface Tasks {
  id: number;
  title: string;
  description: string;
  date: string;
  priority: number;
  member: number[];
  category: string;
  subtasks: Subtask[];
  task_status: string;
  sort_order: number;
}

export interface Subtask {
  id: number;
  title: string;
  done: boolean;
}