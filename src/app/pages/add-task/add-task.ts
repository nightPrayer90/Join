import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../service/supabase';
import { ContactsModel } from '../../shared/models/contacts-model';
import { Subtask } from '../../shared/interface/tasks-interface';
import { TasksModel } from '../../shared/models/tasks-model';

type PriorityKey = 1 | 2 | 3;
type TaskCategoryOption = { id: number; label: string };

@Component({
  selector: 'app-add-task',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-task.html',
  styleUrl: './add-task.scss',
})
export class AddTask implements OnInit, OnDestroy {
  dbService = inject(Supabase);
  private host = inject(ElementRef<HTMLElement>);

  title = '';
  description = '';
  dueDateText = '';
  priority: PriorityKey = 2;
  categoryId: number | null = null;
  dueDateTouched = false;
  saveError = '';
  subtaskInput = '';
  subtasks: Subtask[] = [];
  editingSubtaskId: number | null = null;
  editSubtaskInput = '';

  assignedOpen = false;
  categoryOpen = false;
  submitted = false;

  isSaving = signal(false);
  showToast = signal(false);
  selectedMemberIds = signal<number[]>([]);
  private toastTimeoutId: number | null = null;

  readonly categories: TaskCategoryOption[] = [
    { id: 1, label: 'Technical Tasks' },
    { id: 2, label: 'User Story' },
  ];

  assignedLabel = computed(() => {
    const ids = this.selectedMemberIds();
    if (!ids.length) return 'Select contacts to assign';
    const labels: string[] = [];
    const contacts = this.dbService.contactsList();
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

  ngOnInit(): void {
    this.dbService.getContacts();
  }

  ngOnDestroy(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.host.nativeElement.contains(target)) return;

    const insideAssigned = !!target.closest('.assigned-select');
    const insideCategory = !!target.closest('.category-select');

    if (!insideAssigned) this.assignedOpen = false;
    if (!insideCategory) this.categoryOpen = false;
  }

  setPriority(priority: PriorityKey): void {
    this.priority = priority;
  }

  toggleAssignedDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.assignedOpen = !this.assignedOpen;
    this.categoryOpen = false;
  }

  toggleCategoryDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.categoryOpen = !this.categoryOpen;
    this.assignedOpen = false;
  }

  isMemberSelected(id: number): boolean {
    return this.selectedMemberIds().includes(id);
  }

  toggleMember(id: number): void {
    const current = this.selectedMemberIds();
    if (current.includes(id)) {
      this.selectedMemberIds.set(current.filter((memberId) => memberId !== id));
      return;
    }
    this.selectedMemberIds.set([...current, id]);
  }

  assignedInputValue(): string {
    if (this.assignedOpen) return '';
    return 'Select contacts to assign';
  }

  contactDisplayName(fullName: string, email: string): string {
    const currentEmail = this.dbService.user()?.email?.toLowerCase() ?? '';
    if (currentEmail && currentEmail === email.toLowerCase()) return `${fullName} (You)`;
    return fullName;
  }

  contactInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0).toUpperCase() ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : first;
    return `${first}${last}`;
  }

  categoryLabel(): string {
    const selected = this.categories.find((item) => item.id === this.categoryId);
    return selected?.label ?? '';
  }

  selectCategory(value: TaskCategoryOption): void {
    this.categoryId = value.id;
    this.categoryOpen = false;
  }

  addSubtask(): void {
    const title = this.subtaskInput.trim();
    if (!title) return;
    this.subtasks.push({ id: this.nextSubtaskId(), title, done: false });
    this.subtaskInput = '';
  }

  removeSubtask(id: number): void {
    this.subtasks = this.subtasks.filter((subtask) => subtask.id !== id);
    if (this.editingSubtaskId === id) this.cancelEditSubtask();
  }

  hasSubtaskInput(): boolean {
    return !!this.subtaskInput.trim();
  }

  clearSubtaskInput(): void {
    this.subtaskInput = '';
  }

  startEditSubtask(subtask: Subtask): void {
    this.editingSubtaskId = subtask.id;
    this.editSubtaskInput = subtask.title;
  }

  cancelEditSubtask(): void {
    this.editingSubtaskId = null;
    this.editSubtaskInput = '';
  }

  saveEditedSubtask(): void {
    const id = this.editingSubtaskId;
    const title = this.editSubtaskInput.trim();
    if (id === null || !title) return;
    this.subtasks = this.subtasks.map((subtask) =>
      subtask.id === id ? { ...subtask, title } : subtask
    );
    this.cancelEditSubtask();
  }

  onEditSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.saveEditedSubtask();
  }

  onSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.addSubtask();
  }

  async createTask(): Promise<void> {
    this.submitted = true;
    this.saveError = '';
    if (!this.isFormValid()) return;

    const dueDate = this.parseDueDate(this.dueDateText);
    if (!dueDate) return;

    this.isSaving.set(true);
    const task = new TasksModel();
    task.title = this.title.trim();
    task.description = this.description.trim();
    task.priority = this.priority;
    task.member = [...this.selectedMemberIds()];
    task.category = String(this.categoryId ?? '');
    task.subtasks = [...this.subtasks];
    task.task_status = 'todo';
    task.sort_order = 0;
    task.date = dueDate;

    const taskId = await this.dbService.addTask(task);
    this.isSaving.set(false);
    if (taskId === null) {
      this.saveError = 'Task could not be saved. Please check your data and permissions.';
      return;
    }

    this.clearForm();
    this.submitted = false;
    this.openToast();
  }

  clearForm(): void {
    this.title = '';
    this.description = '';
    this.dueDateText = '';
    this.priority = 2;
    this.categoryId = null;
    this.subtaskInput = '';
    this.subtasks = [];
    this.dueDateTouched = false;
    this.saveError = '';
    this.cancelEditSubtask();
    this.selectedMemberIds.set([]);
    this.assignedOpen = false;
    this.categoryOpen = false;
  }

  isFieldInvalid(field: 'title' | 'date' | 'category'): boolean {
    if (!this.submitted) return false;
    if (field === 'title') return !this.title.trim();
    if (field === 'category') return this.categoryId === null;
    return this.isDueDateInvalid();
  }

  onDueDateBlur(): void {
    this.dueDateTouched = true;
  }

  onDueDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    const parts: string[] = [];

    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 4));
    if (digits.length > 4) parts.push(digits.slice(4, 8));

    this.dueDateText = parts.join('.');
    input.value = this.dueDateText;
  }

  showDateError(): boolean {
    if (!this.submitted && !this.dueDateTouched) return false;
    return this.isDueDateInvalid();
  }

  private isFormValid(): boolean {
    return !!this.title.trim() && this.categoryId !== null && !this.isDueDateInvalid();
  }

  private isDueDateInvalid(): boolean {
    const date = this.parseDueDate(this.dueDateText);
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  private parseDueDate(value: string): Date | null {
    const normalized = value.trim();
    if (!normalized) return null;

    const ddmmyyyy = normalized.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (ddmmyyyy) {
      const day = Number(ddmmyyyy[1]);
      const month = Number(ddmmyyyy[2]);
      const year = Number(ddmmyyyy[3]);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
      date.setHours(0, 0, 0, 0);
      return date;
    }

    const yyyymmdd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!yyyymmdd) return null;
    const year = Number(yyyymmdd[1]);
    const month = Number(yyyymmdd[2]);
    const day = Number(yyyymmdd[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private nextSubtaskId(): number {
    let maxId = 0;
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id > maxId) maxId = this.subtasks[i].id;
    }
    return maxId + 1;
  }

  private openToast(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
    this.showToast.set(true);
    this.toastTimeoutId = window.setTimeout(() => {
      this.showToast.set(false);
      this.toastTimeoutId = null;
    }, 2500);
  }
}
