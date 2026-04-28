export interface Tasks {
  id: number;
  title: string;
  description: string;
  date: string;
  priority: number;
  member: Member[]
  category: string;
  subtasks: Subtask[];
}

export interface Member {
  id: number;
  name: string;
}

export interface Subtask {
  id: number;
  title: string;
  done: boolean;
}