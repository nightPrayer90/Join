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

  /** Cancels the discard prompt or attempts to close the dialog on Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showConfirmDiscard()) return this.onCancelDiscard();
    this.attemptClose();
  }

  /** Closes the assignee dropdown when the user clicks outside of it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.edit-assigned-wrapper')) this.editAssignedOpen = false;
  }

  /** Treats clicks on the overlay like a close request. */
  onOverlayClick(): void {
    this.attemptClose();
  }

  /** Closes the dialog, prompting for discard confirmation when there are unsaved changes. */
  attemptClose(): void {
    if (!this.isEditing()) return this.close.emit();
    if (this.hasEditChanges()) {
      this.showConfirmDiscard.set(true);
      return;
    }
    this.cancelEdit();
  }

  /** Confirms discarding the edits, exits edit mode and closes the dialog. */
  onConfirmDiscard(): void {
    this.showConfirmDiscard.set(false);
    this.cancelEdit();
    this.close.emit();
  }

  /** Hides the discard prompt and keeps the user in edit mode. */
  onCancelDiscard(): void {
    this.showConfirmDiscard.set(false);
  }

  /** Returns true when any edit field has been modified compared to the original task. */
  hasEditChanges(): boolean {
    return this.editScalarsChanged()
      || this.editMembersChanged()
      || this.editSubtasksChanged()
      || !!this.editSubtaskInput.trim();
  }

  /** Compares the scalar edit fields against the original task values. */
  private editScalarsChanged(): boolean {
    return this.editTitle.trim() !== this.task.title
      || this.editDescription.trim() !== this.task.description
      || this.editPriority !== this.task.priority
      || this.editDueDate !== this.task.dueDate;
  }

  /** Compares the selected member ids against the original task members. */
  private editMembersChanged(): boolean {
    const cur = [...this.editMemberIds()].sort((a, b) => a - b);
    const orig = [...this.task.memberIds].sort((a, b) => a - b);
    if (cur.length !== orig.length) return true;
    return cur.some((id, i) => id !== orig[i]);
  }

  /** Compares the current edit subtasks against the original task subtasks. */
  private editSubtasksChanged(): boolean {
    const cur = this.editSubtasks;
    const orig = this.task.subtasks;
    if (cur.length !== orig.length) return true;
    return cur.some((s, i) =>
      s.id !== orig[i].id || s.title !== orig[i].title || s.done !== orig[i].done,
    );
  }

  /** Closes the assignee dropdown when clicking inside the card outside the dropdown. */
  onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.edit-assigned-wrapper')) this.editAssignedOpen = false;
    event.stopPropagation();
  }

  /** Emits a subtask toggle event so the parent can persist the state change. */
  toggleSubtask(subtaskId: number): void {
    this.subtaskToggle.emit({ taskId: this.task.id, subtaskId });
  }

  /** Emits a delete event for the currently displayed task. */
  onDelete(): void {
    this.deleteTask.emit(this.task.id);
  }

  /** Switches the dialog into edit mode and preloads the form fields from the task. */
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

  /** Leaves edit mode without saving and resets the related UI state. */
  cancelEdit(): void {
    this.editAssignedOpen = false;
    this.editDueDateTouched = false;
    this.editSaveAttempted = false;
    this.isEditing.set(false);
  }

  /** Validates the edited values and emits the update payload to the parent. */
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

  /** Returns true when the entered edit due date is missing or in the past. */
  isEditDueDateInvalid(): boolean {
    return TasksModel.isDueDateInvalid(this.editDueDate);
  }

  /** Indicates whether the due-date error message should currently be displayed. */
  showEditDueDateError(): boolean {
    return (this.editSaveAttempted || this.editDueDateTouched) && this.isEditDueDateInvalid();
  }

  /** Returns the appropriate due-date error message based on the input state. */
  editDueDateErrorMessage(): string {
    if (!this.editDueDate.trim()) return 'This field is required';
    return 'Due date must be in the future';
  }

  /** Formats typed digits into "dd/mm/yyyy" while the user is typing. */
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

  /** Marks the edit due-date field as touched so validation errors may appear. */
  onEditDueDateBlur(): void {
    this.editDueDateTouched = true;
  }

  /** Opens the native date picker for the edit due-date field. */
  openEditDatePicker(dateInput: HTMLInputElement): void {
    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
      return;
    }
    dateInput.click();
  }

  /** Reacts to a native date picker selection and converts the value into the visible format. */
  onEditDatePickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const match = input.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;
    this.editDueDate = `${match[3]}/${match[2]}/${match[1]}`;
    this.editDueDateTouched = true;
  }

  /** Updates the edit-mode priority selection. */
  setEditPriority(p: BoardPriority): void {
    this.editPriority = p;
  }

  /** Toggles the edit-mode assignee dropdown open or closed. */
  toggleEditAssigned(event: MouseEvent): void {
    event.stopPropagation();
    this.editAssignedOpen = !this.editAssignedOpen;
  }

  /** Returns true if the given contact id is part of the current edit member selection. */
  isEditMemberSelected(id: number): boolean {
    return this.editMemberIds().includes(id);
  }

  /** Adds or removes a contact from the edit member selection. */
  toggleEditMember(id: number): void {
    const cur = this.editMemberIds();
    if (cur.includes(id)) {
      this.editMemberIds.set(cur.filter(m => m !== id));
    } else {
      this.editMemberIds.set([...cur, id]);
    }
  }

  /** Returns the uppercase initials of the given contact name. */
  contactInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const f = parts[0]?.charAt(0).toUpperCase() ?? '';
    const l = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : f;
    return `${f}${l}`;
  }

  /** Appends the current subtask input as a new subtask in edit mode. */
  addEditSubtask(): void {
    const title = this.editSubtaskInput.trim();
    if (!title) return;
    const id = this.nextEditSubtaskId();
    this.editSubtasks = [...this.editSubtasks, { id, title, done: false }];
    this.editSubtaskInput = '';
  }

  /** Removes a subtask from the edit list by its id. */
  removeEditSubtask(id: number): void {
    this.editSubtasks = this.editSubtasks.filter(s => s.id !== id);
  }

  /** Handles the Enter key inside the edit subtask input. */
  onEditSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.addEditSubtask();
  }

  /** Returns true if the edit subtask input currently contains non-whitespace text. */
  hasEditSubtaskInput(): boolean {
    return !!this.editSubtaskInput.trim();
  }

  /** Returns the next available subtask id based on the highest existing id. */
  private nextEditSubtaskId(): number {
    let max = 0;
    for (let i = 0; i < this.editSubtasks.length; i++) {
      if (this.editSubtasks[i].id > max) max = this.editSubtasks[i].id;
    }
    return max + 1;
  }
}
