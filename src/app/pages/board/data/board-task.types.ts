export type BoardStatus = 'todo' | 'in-progress' | 'await-feedback' | 'done';
export type BoardPriority = 'urgent' | 'medium' | 'low';
export type BoardCategory = 'User Story' | 'Technical Task';

export interface BoardSubtask {
  id: number;
  title: string;
  done: boolean;
}

export interface BoardAssignee {
  initials: string;
  fullName: string;
  color: string;
}

export interface BoardTask {
  id: string;
  category: BoardCategory;
  title: string;
  description: string;
  dueDate: string;
  priority: BoardPriority;
  assignees: BoardAssignee[];
  memberIds: number[];
  subtasks: BoardSubtask[];
  status: BoardStatus;
  sortOrder: number;
}

export interface BoardColumn {
  key: BoardStatus;
  title: string;
}
