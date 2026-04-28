import { Component, EventEmitter, HostListener, inject, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardPriority, BoardSubtask, BoardTask } from '../../data/board-task.types';
import { Supabase } from '../../../../service/supabase';

interface TaskUpdatePayload {
  id: string;
  title: string;
  description: string;
  priority: BoardPriority;
  dueDate: string;
  memberIds: number[];
  subtasks: BoardSubtask[];
}

@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './task-detail-dialog.html',
  styleUrl: './task-detail-dialog.scss',
})
export class TaskDetailDialog {
  @Input({ required: true }) task!: BoardTask;
  @Output() close = new EventEmitter<void>();
  @Output() subtaskToggle = new EventEmitter<{ taskId: string; subtaskId: number }>();
  @Output() deleteTask = new EventEmitter<string>();
  @Output() taskUpdated = new EventEmitter<TaskUpdatePayload>();

  dbService = inject(Supabase);

  readonly priorityLabels: Record<BoardPriority, string> = {
    urgent: 'Urgent',
    medium: 'Medium',
    low: 'Low',
  };

  isEditing = signal(false);
  editTitle = '';
  editDescription = '';
  editPriority: BoardPriority = 'medium';
  editDueDate = '';
  editMemberIds = signal<number[]>([]);
  editAssignedOpen = false;
  editSubtasks: BoardSubtask[] = [];
  editSubtaskInput = '';

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isEditing()) return this.cancelEdit();
    this.close.emit();
  }

  onOverlayClick(): void {
    if (this.isEditing()) return this.cancelEdit();
    this.close.emit();
  }

  onCardClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  toggleSubtask(subtaskId: number): void {
    this.subtaskToggle.emit({ taskId: this.task.id, subtaskId });
  }

  onDelete(): void {
    this.deleteTask.emit(this.task.id);
  }

  startEdit(): void {
    this.editTitle = this.task.title;
    this.editDescription = this.task.description;
    this.editPriority = this.task.priority;
    this.editDueDate = this.task.dueDate;
    this.editMemberIds.set([...this.task.memberIds]);
    this.editSubtasks = this.task.subtasks.map(s => ({ ...s }));
    this.editSubtaskInput = '';
    this.editAssignedOpen = false;
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.editAssignedOpen = false;
    this.isEditing.set(false);
  }

  saveEdit(): void {
    if (!this.editTitle.trim()) return;
    this.taskUpdated.emit({
      id: this.task.id,
      title: this.editTitle.trim(),
      description: this.editDescription.trim(),
      priority: this.editPriority,
      dueDate: this.editDueDate,
      memberIds: [...this.editMemberIds()],
      subtasks: [...this.editSubtasks],
    });
    this.isEditing.set(false);
  }

  setEditPriority(p: BoardPriority): void {
    this.editPriority = p;
  }

  toggleEditAssigned(event: MouseEvent): void {
    event.stopPropagation();
    this.editAssignedOpen = !this.editAssignedOpen;
  }

  isEditMemberSelected(id: number): boolean {
    return this.editMemberIds().includes(id);
  }

  toggleEditMember(id: number): void {
    const cur = this.editMemberIds();
    if (cur.includes(id)) {
      this.editMemberIds.set(cur.filter(m => m !== id));
    } else {
      this.editMemberIds.set([...cur, id]);
    }
  }

  contactInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const f = parts[0]?.charAt(0).toUpperCase() ?? '';
    const l = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : f;
    return `${f}${l}`;
  }

  addEditSubtask(): void {
    const title = this.editSubtaskInput.trim();
    if (!title) return;
    const id = this.nextEditSubtaskId();
    this.editSubtasks = [...this.editSubtasks, { id, title, done: false }];
    this.editSubtaskInput = '';
  }

  removeEditSubtask(id: number): void {
    this.editSubtasks = this.editSubtasks.filter(s => s.id !== id);
  }

  onEditSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.addEditSubtask();
  }

  hasEditSubtaskInput(): boolean {
    return !!this.editSubtaskInput.trim();
  }

  private nextEditSubtaskId(): number {
    let max = 0;
    for (let i = 0; i < this.editSubtasks.length; i++) {
      if (this.editSubtasks[i].id > max) max = this.editSubtasks[i].id;
    }
    return max + 1;
  }
}
