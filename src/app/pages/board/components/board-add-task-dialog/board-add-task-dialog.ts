import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnInit, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardStatus } from '../../data/board-task.types';
import { Supabase } from '../../../../service/supabase';
import { Subtask } from '../../../../shared/interface/tasks-interface';
import { TasksModel } from '../../../../shared/models/tasks-model';
import { ContactsModel } from '../../../../shared/models/contacts-model';
import { CategoryModel } from '../../../../shared/models/category-model';
import { ConfirmDiscardDialog } from '../../../../shared/components/confirm-discard-dialog/confirm-discard-dialog';

type PriorityKey = 1 | 2 | 3;

@Component({
  selector: 'app-board-add-task-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDiscardDialog],
  templateUrl: './board-add-task-dialog.html',
  styleUrl: './board-add-task-dialog.scss',
})
export class BoardAddTaskDialog implements OnInit {
  @Input() presetStatus: BoardStatus = 'todo';
  @Output() closed = new EventEmitter<void>();
  @Output() taskCreated = new EventEmitter<void>();

  dbService = inject(Supabase);
  readonly categories = CategoryModel.LIST;
  private host = inject(ElementRef<HTMLElement>);

  title = '';
  description = '';
  dueDateText = '';
  minDateISO = '';
  priority: PriorityKey = 2;
  categoryId: number | null = null;
  subtaskInput = '';
  subtasks: Subtask[] = [];
  submitted = false;
  dueDateTouched = false;
  saveError = '';
  assignedOpen = false;
  categoryOpen = false;

  isSaving = signal(false);
  selectedMemberIds = signal<number[]>([]);
  showConfirmDiscard = signal(false);

  assignedLabel = computed(() => {
    const ids = this.selectedMemberIds();
    if (!ids.length) return 'Select contacts to assign';
    const contacts = this.dbService.contactsList();
    const labels: string[] = [];
    for (let i = 0; i < contacts.length; i++) {
      if (ids.includes(contacts[i].id)) labels.push(contacts[i].full_name);
    }
    return labels.join(', ');
  });

  selectedContacts = computed(() => {
    const ids = this.selectedMemberIds();
    const contacts = this.dbService.contactsList();
    const selected: ContactsModel[] = [];
    for (let i = 0; i < contacts.length; i++) {
      if (ids.includes(contacts[i].id)) selected.push(contacts[i]);
    }
    return selected;
  });

  /** Initializes the minimum due date and preloads the contacts list. */
  ngOnInit(): void {
    this.minDateISO = TasksModel.todayISO();
    this.dbService.getContacts();
  }

  /** Cancels the discard prompt or attempts to close the dialog on Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showConfirmDiscard()) return this.onCancelDiscard();
    this.attemptClose();
  }

  /** Closes the assignee or category dropdowns when clicking outside them. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.host.nativeElement.contains(target)) return;
    if (!target.closest('.assigned-select')) this.assignedOpen = false;
    if (!target.closest('.category-select')) this.categoryOpen = false;
  }

  /** Treats clicks on the overlay like a close request. */
  onOverlayClick(): void {
    this.attemptClose();
  }

  /** Closes the dialog, prompting for discard confirmation when there are unsaved changes. */
  attemptClose(): void {
    if (this.hasUnsavedChanges()) {
      this.showConfirmDiscard.set(true);
      return;
    }
    this.closed.emit();
  }

  /** Confirms discarding the changes and closes the dialog. */
  onConfirmDiscard(): void {
    this.showConfirmDiscard.set(false);
    this.closed.emit();
  }

  /** Hides the discard prompt so the user can keep editing. */
  onCancelDiscard(): void {
    this.showConfirmDiscard.set(false);
  }

  /** Returns true when the form contains any unsaved input. */
  hasUnsavedChanges(): boolean {
    return this.hasTextInput() || this.hasFieldChange() || this.hasCollectionChange();
  }

  /** Returns true if any text input field currently holds non-whitespace content. */
  private hasTextInput(): boolean {
    return !!this.title.trim()
      || !!this.description.trim()
      || !!this.dueDateText.trim()
      || !!this.subtaskInput.trim();
  }

  /** Returns true when the priority or category has been changed from the defaults. */
  private hasFieldChange(): boolean {
    return this.priority !== 2 || this.categoryId !== null;
  }

  /** Returns true when at least one member is selected or a subtask has been added. */
  private hasCollectionChange(): boolean {
    return this.selectedMemberIds().length > 0 || this.subtasks.length > 0;
  }

  /** Closes the dropdowns when clicking inside the panel but outside the dropdowns. */
  onPanelClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.assigned-select')) this.assignedOpen = false;
    if (!target.closest('.category-select')) this.categoryOpen = false;
    event.stopPropagation();
  }

  /** Sets the task priority. */
  setPriority(p: PriorityKey): void {
    this.priority = p;
  }

  /** Toggles the assignee dropdown open or closed and closes the category dropdown. */
  toggleAssigned(event: MouseEvent): void {
    event.stopPropagation();
    this.assignedOpen = !this.assignedOpen;
    this.categoryOpen = false;
  }

  /** Toggles the category dropdown open or closed and closes the assignee dropdown. */
  toggleCategory(event: MouseEvent): void {
    event.stopPropagation();
    this.categoryOpen = !this.categoryOpen;
    this.assignedOpen = false;
  }

  /** Returns true if the given contact id is currently selected. */
  isMemberSelected(id: number): boolean {
    return this.selectedMemberIds().includes(id);
  }

  /** Adds or removes a contact from the selected members list. */
  toggleMember(id: number): void {
    const cur = this.selectedMemberIds();
    if (cur.includes(id)) {
      this.selectedMemberIds.set(cur.filter(m => m !== id));
    } else {
      this.selectedMemberIds.set([...cur, id]);
    }
  }

  /** Stores the chosen category and closes the dropdown. */
  selectCategory(cat: CategoryModel): void {
  this.categoryId = cat.id;
  this.categoryOpen = false;
}


  /** Returns the label of the currently selected category or an empty string. */
  categoryLabel(): string {
  return CategoryModel.findById(this.categoryId)?.name ?? '';
}

  /** Appends the current subtask input as a new subtask in the form. */
  addSubtask(): void {
    const t = this.subtaskInput.trim();
    if (!t) return;
    this.subtasks.push({ id: this.nextSubtaskId(), title: t, done: false });
    this.subtaskInput = '';
  }

  /** Removes a subtask from the form by its id. */
  removeSubtask(id: number): void {
    this.subtasks = this.subtasks.filter(s => s.id !== id);
  }

  /** Handles the Enter key inside the subtask input field. */
  onSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.addSubtask();
  }

  /** Returns true if the subtask input currently contains non-whitespace text. */
  hasSubtaskInput(): boolean {
    return !!this.subtaskInput.trim();
  }

  /** Clears the subtask input field. */
  clearSubtaskInput(): void {
    this.subtaskInput = '';
  }

  /** Formats typed digits into "dd/mm/yyyy" while the user is typing. */
  onDueDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 4));
    if (digits.length > 4) parts.push(digits.slice(4, 8));
    this.dueDateText = parts.join('/');
    input.value = this.dueDateText;
  }

  /** Opens the native date picker for the due-date field. */
  openDatePicker(dateInput: HTMLInputElement): void {
    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
      return;
    }
    dateInput.click();
  }

  /** Reacts to a native date picker selection and converts the value into the visible format. */
  onDatePickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) return;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;
    this.dueDateText = `${match[3]}/${match[2]}/${match[1]}`;
    this.dueDateTouched = true;
  }

  /** Marks the due-date field as touched so validation errors may appear. */
  onDueDateBlur(): void {
    this.dueDateTouched = true;
  }

  /** Returns true if the given form field should currently be displayed as invalid. */
  isFieldInvalid(field: 'title' | 'date' | 'category'): boolean {
    if (!this.submitted) return false;
    if (field === 'title') return !this.title.trim();
    if (field === 'category') return this.categoryId === null;
    return this.isDueDateInvalid();
  }

  /** Indicates whether the due-date error message should currently be displayed. */
  showDateError(): boolean {
    if (!this.submitted && !this.dueDateTouched) return false;
    return this.isDueDateInvalid();
  }

  /** Validates the form and creates the new task in the database. */
  async createTask(): Promise<void> {
    this.submitted = true;
    this.saveError = '';
    if (!this.isFormValid()) return;
    const dueDate = this.parseDueDate(this.dueDateText);
    if (!dueDate) return;
    const task = this.buildTaskPayload(dueDate);
    await this.persistNewTask(task);
  }

  /** Builds a TasksModel instance from the current form state. */
  private buildTaskPayload(dueDate: Date): TasksModel {
    const task = new TasksModel();
    task.title = this.title.trim();
    task.description = this.description.trim();
    task.priority = this.priority;
    task.member = [...this.selectedMemberIds()];
    task.category = this.categoryId ?? 0;
    task.subtasks = [...this.subtasks];
    task.task_status = this.presetStatus;
    task.sort_order = 0;
    task.date = dueDate;
    return task;
  }

  /** Saves the new task to the database and emits the appropriate events. */
  private async persistNewTask(task: TasksModel): Promise<void> {
    this.isSaving.set(true);
    const id = await this.dbService.addTask(task);
    this.isSaving.set(false);
    if (id === null) {
      this.saveError = 'Task could not be saved.';
      return;
    }
    this.taskCreated.emit();
    this.closed.emit();
  }

  /** Returns true when all required fields are filled and the due date is valid. */
  private isFormValid(): boolean {
    return !!this.title.trim() && this.categoryId !== null && !this.isDueDateInvalid();
  }

  /** Returns true if the entered due date is missing or in the past. */
  private isDueDateInvalid(): boolean {
    const d = this.parseDueDate(this.dueDateText);
    if (!d) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }

  /** Parses a "dd/mm/yyyy" formatted string into a Date or returns null on invalid input. */
  private parseDueDate(value: string): Date | null {
    const n = value.trim();
    if (!n) return null;
    const m = n.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (!m) return null;
    const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Returns the next available subtask id based on the highest existing id. */
  private nextSubtaskId(): number {
    let max = 0;
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id > max) max = this.subtasks[i].id;
    }
    return max + 1;
  }
}
