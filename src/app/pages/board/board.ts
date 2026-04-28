import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardColumn, BoardStatus, BoardTask } from './data/board-task.types';
import { MOCK_TASKS } from './data/mock-tasks';
import { TaskCard } from './components/task-card/task-card';
import { TaskDetailDialog } from './components/task-detail-dialog/task-detail-dialog';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [FormsModule, TaskCard, TaskDetailDialog],
  templateUrl: './board.html',
  styleUrl: './board.scss',
})
export class Board {
  readonly columns: BoardColumn[] = [
    { key: 'todo',           title: 'To do' },
    { key: 'in-progress',    title: 'In progress' },
    { key: 'await-feedback', title: 'Await feedback' },
    { key: 'done',           title: 'Done' },
  ];

  readonly tasks = signal<BoardTask[]>(MOCK_TASKS);
  readonly searchTerm = signal<string>('');
  readonly selectedTask = signal<BoardTask | null>(null);
  readonly dragOverColumn = signal<BoardStatus | null>(null);
  readonly draggingTaskId = signal<string | null>(null);

  readonly filtered = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.tasks();
    return this.tasks().filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  });

  tasksByStatus(status: BoardStatus): BoardTask[] {
    return this.filtered().filter(t => t.status === status);
  }

  openTask(task: BoardTask): void {
    this.selectedTask.set(task);
  }

  closeDialog(): void {
    this.selectedTask.set(null);
  }

  onDragStart(event: DragEvent, taskId: string): void {
    event.dataTransfer?.setData('text/plain', taskId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.draggingTaskId.set(taskId);
  }

  onDragEnd(): void {
    this.draggingTaskId.set(null);
    this.dragOverColumn.set(null);
  }

  onDragOver(event: DragEvent, status: BoardStatus): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dragOverColumn() !== status) this.dragOverColumn.set(status);
  }

  onDragLeave(event: DragEvent, status: BoardStatus): void {
    const related = event.relatedTarget as Node | null;
    const current = event.currentTarget as HTMLElement | null;
    if (current && related && current.contains(related)) return;
    if (this.dragOverColumn() === status) this.dragOverColumn.set(null);
  }

  onDrop(event: DragEvent, status: BoardStatus): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.draggingTaskId();
    this.dragOverColumn.set(null);
    this.draggingTaskId.set(null);
    if (!id) return;
    this.tasks.update(list =>
      list.map(t => (t.id === id ? { ...t, status } : t)),
    );
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }
}
