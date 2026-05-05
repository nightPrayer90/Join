import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BoardAssignee,
  BoardColumn,
  BoardPriority,
  BoardStatus,
  BoardSubtask,
  BoardTask,
} from './data/board-task.types';
import { TaskCard } from './components/task-card/task-card';
import { TaskDetailDialog } from './components/task-detail-dialog/task-detail-dialog';
import { BoardAddTaskDialog } from './components/board-add-task-dialog/board-add-task-dialog';
import { Supabase } from '../../service/supabase';
import { TasksModel } from '../../shared/models/tasks-model';
import { ContactsModel } from '../../shared/models/contacts-model';

/**
 * Kanban board component that displays tasks in status-based columns.
 *
 * Reads {@link TasksModel} and {@link ContactsModel} from the Supabase service,
 * maps them to UI-specific {@link BoardTask} objects, and persists
 * status changes via drag-and-drop back to the database.
 */
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [FormsModule, TaskCard, TaskDetailDialog, BoardAddTaskDialog],
  templateUrl: './board.html',
  styleUrl: './board.scss',
})
export class Board {
  private dbService = inject(Supabase);
  private router = inject(Router);

  readonly columns: BoardColumn[] = [
    { key: 'todo', title: 'To do' },
    { key: 'in-progress', title: 'In progress' },
    { key: 'await-feedback', title: 'Await feedback' },
    { key: 'done', title: 'Done' },
  ];

  readonly searchTerm = signal<string>('');
  readonly selectedTask = signal<BoardTask | null>(null);
  readonly dragOverColumn = signal<BoardStatus | null>(null);
  readonly draggingTaskId = signal<string | null>(null);
  readonly dropTarget = signal<{ column: BoardStatus; index: number } | null>(null);
  readonly showAddDialog = signal(false);
  readonly addDialogStatus = signal<BoardStatus>('todo');
  readonly openMenuTaskId = signal<string | null>(null);

  readonly tasks = computed(() => {
    const models = this.dbService.tasksList();
    const contacts = this.dbService.contactsList();
    return models.map((t) => this.mapTask(t, contacts));
  });

  readonly filtered = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.tasks();
    return this.tasks().filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  });

  /**
   * Returns all filtered tasks that belong to the given column status.
   */
  tasksByStatus(status: BoardStatus): BoardTask[] {
    return this.filtered()
      .filter((t) => t.status === status)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Opens the detail dialog for a given task.
   */
  openTask(task: BoardTask): void {
    this.selectedTask.set(task);
  }

  /** Closes the currently open detail dialog. */
  closeDialog(): void {
    this.selectedTask.set(null);
  }

  /**
   * Initializes a drag operation by storing the task ID in the data transfer.
   */
  onDragStart(event: DragEvent, taskId: string): void {
    event.dataTransfer?.setData('text/plain', taskId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.draggingTaskId.set(taskId);
  }

  /** Resets all drag state when the drag operation ends. */
  onDragEnd(): void {
    this.draggingTaskId.set(null);
    this.dragOverColumn.set(null);
    this.dropTarget.set(null);
  }

  /** Allows drop on the column and highlights it. */
  onDragOver(event: DragEvent, status: BoardStatus): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dragOverColumn() !== status) this.dragOverColumn.set(status);
  }

  /** Tracks the insert index when dragging over a specific card. */
  onCardDragOver(event: DragEvent, status: BoardStatus, cardIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.dragOverColumn() !== status) this.dragOverColumn.set(status);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const idx = event.clientY < midY ? cardIndex : cardIndex + 1;
    this.dropTarget.set({ column: status, index: idx });
  }

  /** Removes drop-target highlight when leaving a column boundary. */
  onDragLeave(event: DragEvent, status: BoardStatus): void {
    const related = event.relatedTarget as Node | null;
    const current = event.currentTarget as HTMLElement | null;
    if (current && related && current.contains(related)) return;
    if (this.dragOverColumn() === status) {
      this.dragOverColumn.set(null);
      this.dropTarget.set(null);
    }
  }

  /** Handles the drop at the tracked position and persists sort order. */
  onDrop(event: DragEvent, status: BoardStatus): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.draggingTaskId();
    const target = this.dropTarget();
    this.dragOverColumn.set(null);
    this.draggingTaskId.set(null);
    this.dropTarget.set(null);
    if (!id) return;
    const insertIdx =
      target && target.column === status ? target.index : this.tasksByStatus(status).length;
    this.persistDrop(Number(id), status, insertIdx);
  }

  /**
   * Updates the search term signal used by the filtered computed.
   */
  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  /**
   * Moves a task to the target column via the mobile/tablet menu.
   * Appends at the end of the column and persists sort order.
   */
  onMoveStatus(taskId: string, status: BoardStatus): void {
    const insertIdx = this.tasksByStatus(status).length;
    this.persistDrop(Number(taskId), status, insertIdx);
  }

  /** Opens the board add-task dialog on desktop and the shared add-task page on smaller screens. */
  openAddDialog(status: BoardStatus): void {
    this.addDialogStatus.set(status);
    this.showAddDialog.set(true);
  }

  /** Closes the add-task dialog. */
  closeAddDialog(): void {
    this.showAddDialog.set(false);}
  /** Opens the shared add-task page from every board add-task entry point. */
  openAddPage(_status: BoardStatus): void {
    this.router.navigate(['/add-task'], { queryParams: { from: 'board' } });
  }

  /** Toggles a subtask's done state and persists it to Supabase. */
  onSubtaskToggle(taskId: string, subtaskId: number): void {
    const task = this.findTaskModel(taskId);
    if (!task) return;
    const sub = task.subtasks.find((s) => s.id === subtaskId);
    if (!sub) return;
    task.updateSubtaskDone(subtaskId, !sub.done);
    this.refreshAndPersist(task);
    this.refreshSelectedTask(taskId);
  }

  /** Deletes a task from the database and closes the dialog. */
  onDeleteTask(taskId: string): void {
    this.selectedTask.set(null);
    this.dbService.deleteTask(Number(taskId));
  }

  /** Applies inline-edit changes back to the TasksModel and persists. */
  onTaskUpdated(payload: {
    id: string;
    title: string;
    description: string;
    priority: BoardPriority;
    dueDate: string;
    memberIds: number[];
    subtasks: BoardSubtask[];
  }): void {
    const task = this.findTaskModel(payload.id);
    if (!task) return;
    task.title = payload.title;
    task.description = payload.description;
    task.priority = this.reversePriority(payload.priority);
    task.date = TasksModel.parseDate(payload.dueDate) ?? new Date();
    task.member = [...payload.memberIds];
    task.subtasks = payload.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done }));
    this.refreshAndPersist(task);
    this.refreshSelectedTask(payload.id);
  }

  /** Moves a task to a target column at a specific index, reorders, and persists all changes. */
  private persistDrop(id: number, status: BoardStatus, insertIdx: number): void {
    const allTasks = this.dbService.tasksList();
    const moved = allTasks.find((t) => t.id === id);
    if (!moved) return;
    moved.task_status = status;
    const columnTasks = allTasks
      .filter((t) => t.task_status === status && t.id !== id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    columnTasks.splice(insertIdx, 0, moved);
    for (let i = 0; i < columnTasks.length; i++) {
      columnTasks[i].sort_order = i;
      this.dbService.updateTask(columnTasks[i]);
    }
    this.dbService.tasksList.update((list) => [...list]);
  }

  /**
   * Converts a database TasksModel into a UI-ready BoardTask.
   * Resolves member IDs to contact details and translates numeric enums to string labels.
   */
  private mapTask(task: TasksModel, contacts: ContactsModel[]): BoardTask {
    return {
      id: String(task.id),
      title: task.title,
      description: task.description,
      dueDate: task.dateDisplay,
      priority: this.mapPriority(task.priority),
      category: task.getCategory(),
      assignees: this.resolveAssignees(task.member, contacts),
      memberIds: [...task.member],
      subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
      status: (task.task_status || 'todo') as BoardStatus,
      sortOrder: task.sort_order ?? 0,
    };
  }

  /**
   * Maps a numeric priority (1 = urgent, 2 = medium, 3 = low) to a BoardPriority label.
   */
  private mapPriority(value: number): BoardPriority {
    if (value === 1) return 'urgent';
    if (value === 3) return 'low';
    return 'medium';
  }

  /**
   * Resolves an array of contact IDs into BoardAssignee objects with initials, name and color.
   * Silently skips IDs that no longer exist in the contacts list.
   */
  private resolveAssignees(ids: number[], contacts: ContactsModel[]): BoardAssignee[] {
    const result: BoardAssignee[] = [];
    for (let i = 0; i < ids.length; i++) {
      const c = contacts.find((ct) => ct.id === ids[i]);
      if (!c) continue;
      result.push({ initials: c.getInitials(), fullName: c.full_name, color: c.avatar_color });
    }
    return result;
  }

  /** Reverse-maps a BoardPriority label to its numeric DB value. */
  private reversePriority(p: BoardPriority): number {
    if (p === 'urgent') return 1;
    if (p === 'low') return 3;
    return 2;
  }

  /** Finds the original TasksModel by its string ID. */
  private findTaskModel(id: string): TasksModel | undefined {
    return this.dbService.tasksList().find((t) => t.id === Number(id));
  }

  /** Triggers a signal refresh and persists the task to Supabase. */
  private refreshAndPersist(task: TasksModel): void {
    this.dbService.tasksList.update((list) => [...list]);
    this.dbService.updateTask(task);
  }

  /** Re-maps the selected task so the dialog reflects updated data. */
  private refreshSelectedTask(id: string): void {
    const updated = this.tasks().find((t) => t.id === id);
    if (updated) this.selectedTask.set(updated);
  }

  /** Toggles a card's move menu; closes any other open menu (only one at a time). */
  onMenuToggle(taskId: string): void {
    this.openMenuTaskId.update((current) => (current === taskId ? null : taskId));
  }

  /** Closes any currently open move menu. */
  onMenuClose(): void {
    this.openMenuTaskId.set(null);
  }
}
