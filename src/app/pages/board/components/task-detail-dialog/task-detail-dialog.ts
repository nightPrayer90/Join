import { Component, ElementRef, EventEmitter, HostListener, inject, Input, Output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardPriority, BoardSubtask, BoardTask } from '../../data/board-task.types';
import { Supabase } from '../../../../service/supabase';
import { TasksModel } from '../../../../shared/models/tasks-model';
import { ConfirmDiscardDialog } from '../../../../shared/components/confirm-discard-dialog/confirm-discard-dialog';

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
  imports: [FormsModule, ConfirmDiscardDialog],
  templateUrl: './task-detail-dialog.html',
  styleUrl: './task-detail-dialog.scss',
})
export class TaskDetailDialog {
  @Input({ required: true }) task!: BoardTask;
  @Output() close = new EventEmitter<void>();
  @Output() subtaskToggle = new EventEmitter<{ taskId: string; subtaskId: number }>();
  @Output() deleteTask = new EventEmitter<string>();
  @Output() taskUpdated = new EventEmitter<TaskUpdatePayload>();
  @ViewChild('detailCard') detailCard?: ElementRef<HTMLElement>;

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
  editDueDateTouched = false;
  minDateISO = TasksModel.todayISO();
  editMemberIds = signal<number[]>([]);
  editAssignedOpen = false;
  editSubtasks: BoardSubtask[] = [];
  editSubtaskInput = '';
  editSaveAttempted = false;
  showConfirmDiscard = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showConfirmDiscard()) return this.onCancelDiscard();
    this.attemptClose();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.edit-assigned-wrapper')) this.editAssignedOpen = false;
  }

  onOverlayClick(): void {
    this.attemptClose();
  }

  attemptClose(): void {
    if (!this.isEditing()) return this.close.emit();
    if (this.hasEditChanges()) {
      this.showConfirmDiscard.set(true);
      return;
    }
    this.cancelEdit();
  }

  onConfirmDiscard(): void {
    this.showConfirmDiscard.set(false);
    this.cancelEdit();
    this.close.emit();
  }

  onCancelDiscard(): void {
    this.showConfirmDiscard.set(false);
  }

  hasEditChanges(): boolean {
    return this.editScalarsChanged()
      || this.editMembersChanged()
      || this.editSubtasksChanged()
      || !!this.editSubtaskInput.trim();
  }

  private editScalarsChanged(): boolean {
    return this.editTitle.trim() !== this.task.title
      || this.editDescription.trim() !== this.task.description
      || this.editPriority !== this.task.priority
      || this.editDueDate !== this.task.dueDate;
  }

  private editMembersChanged(): boolean {
    const cur = [...this.editMemberIds()].sort((a, b) => a - b);
    const orig = [...this.task.memberIds].sort((a, b) => a - b);
    if (cur.length !== orig.length) return true;
    return cur.some((id, i) => id !== orig[i]);
  }

  private editSubtasksChanged(): boolean {
    const cur = this.editSubtasks;
    const orig = this.task.subtasks;
    if (cur.length !== orig.length) return true;
    return cur.some((s, i) =>
      s.id !== orig[i].id || s.title !== orig[i].title || s.done !== orig[i].done,
    );
  }

  onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.edit-assigned-wrapper')) this.editAssignedOpen = false;
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
    this.editDueDateTouched = false;
    this.editSaveAttempted = false;
    this.isEditing.set(true);
    requestAnimationFrame(() => this.detailCard?.nativeElement.scrollTo({ top: 0 }));
  }

  cancelEdit(): void {
    this.editAssignedOpen = false;
    this.editDueDateTouched = false;
    this.editSaveAttempted = false;
    this.isEditing.set(false);
  }

  saveEdit(): void {
    this.editSaveAttempted = true;
    if (!this.editTitle.trim() || this.isEditDueDateInvalid()) return;
    this.taskUpdated.emit({
      id: this.task.id,
      title: this.editTitle.trim(),
      description: this.editDescription.trim(),
      priority: this.editPriority,
      dueDate: this.editDueDate,
      memberIds: [...this.editMemberIds()],
      subtasks: [...this.editSubtasks],
    });
    this.editSaveAttempted = false;
    this.isEditing.set(false);
  }

  isEditDueDateInvalid(): boolean {
    return TasksModel.isDueDateInvalid(this.editDueDate);
  }

  showEditDueDateError(): boolean {
    return (this.editSaveAttempted || this.editDueDateTouched) && this.isEditDueDateInvalid();
  }

  editDueDateErrorMessage(): string {
    if (!this.editDueDate.trim()) return 'This field is required';
    return 'Due date must be in the future';
  }

  onEditDueDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 4));
    if (digits.length > 4) parts.push(digits.slice(4, 8));
    this.editDueDate = parts.join('/');
    input.value = this.editDueDate;
  }

  onEditDueDateBlur(): void {
    this.editDueDateTouched = true;
  }

  openEditDatePicker(dateInput: HTMLInputElement): void {
    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
      return;
    }
    dateInput.click();
  }

  onEditDatePickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const match = input.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;
    this.editDueDate = `${match[3]}/${match[2]}/${match[1]}`;
    this.editDueDateTouched = true;
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
