export interface Tasks {
  id: number;
  title: string;
  description: string;
  date: string;
  priority: number;
  member: number[];
  category: string;
  subtasks: Subtask[];
}

export interface Subtask {
  id: number;
  title: string;
  done: boolean;
}