import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnInit, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardStatus } from '../../data/board-task.types';
import { Supabase } from '../../../../service/supabase';
import { Subtask } from '../../../../shared/interface/tasks-interface';
import { TasksModel } from '../../../../shared/models/tasks-model';
import { ContactsModel } from '../../../../shared/models/contacts-model';
import { CategoryModel } from '../../../../shared/models/category-model';

type PriorityKey = 1 | 2 | 3;

@Component({
  selector: 'app-board-add-task-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './board-add-task-dialog.html',
  styleUrl: './board-add-task-dialog.scss',
})
export class BoardAddTaskDialog implements OnInit {
  @Input() presetStatus: BoardStatus = 'todo';
  @Output() closed = new EventEmitter<void>();

  dbService = inject(Supabase);
  readonly categories = CategoryModel.LIST;
  private host = inject(ElementRef<HTMLElement>);

  title = '';
  description = '';
  dueDateText = '';
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

  ngOnInit(): void {
    this.dbService.getContacts();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.host.nativeElement.contains(target)) return;
    if (!target.closest('.assigned-select')) this.assignedOpen = false;
    if (!target.closest('.category-select')) this.categoryOpen = false;
  }

  onOverlayClick(): void {
    this.closed.emit();
  }

  onPanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  setPriority(p: PriorityKey): void {
    this.priority = p;
  }

  toggleAssigned(event: MouseEvent): void {
    event.stopPropagation();
    this.assignedOpen = !this.assignedOpen;
    this.categoryOpen = false;
  }

  toggleCategory(event: MouseEvent): void {
    event.stopPropagation();
    this.categoryOpen = !this.categoryOpen;
    this.assignedOpen = false;
  }

  isMemberSelected(id: number): boolean {
    return this.selectedMemberIds().includes(id);
  }

  toggleMember(id: number): void {
    const cur = this.selectedMemberIds();
    if (cur.includes(id)) {
      this.selectedMemberIds.set(cur.filter(m => m !== id));
    } else {
      this.selectedMemberIds.set([...cur, id]);
    }
  }

  selectCategory(cat: CategoryModel): void {
  this.categoryId = cat.id;
  this.categoryOpen = false;
}


  categoryLabel(): string {
  return CategoryModel.findById(this.categoryId)?.name ?? '';
}

  contactInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const f = parts[0]?.charAt(0).toUpperCase() ?? '';
    const l = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : f;
    return `${f}${l}`;
  }

  addSubtask(): void {
    const t = this.subtaskInput.trim();
    if (!t) return;
    this.subtasks.push({ id: this.nextSubtaskId(), title: t, done: false });
    this.subtaskInput = '';
  }

  removeSubtask(id: number): void {
    this.subtasks = this.subtasks.filter(s => s.id !== id);
  }

  onSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.addSubtask();
  }

  hasSubtaskInput(): boolean {
    return !!this.subtaskInput.trim();
  }

  clearSubtaskInput(): void {
    this.subtaskInput = '';
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

  onDueDateBlur(): void {
    this.dueDateTouched = true;
  }

  isFieldInvalid(field: 'title' | 'date' | 'category'): boolean {
    if (!this.submitted) return false;
    if (field === 'title') return !this.title.trim();
    if (field === 'category') return this.categoryId === null;
    return this.isDueDateInvalid();
  }

  showDateError(): boolean {
    if (!this.submitted && !this.dueDateTouched) return false;
    return this.isDueDateInvalid();
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
    task.category = this.categoryId ?? 0;
    task.subtasks = [...this.subtasks];
    task.task_status = this.presetStatus;
    task.sort_order = 0;
    task.date = dueDate;

    const id = await this.dbService.addTask(task);
    this.isSaving.set(false);
    if (id === null) {
      this.saveError = 'Task could not be saved.';
      return;
    }
    this.closed.emit();
  }

  private isFormValid(): boolean {
    return !!this.title.trim() && this.categoryId !== null && !this.isDueDateInvalid();
  }

  private isDueDateInvalid(): boolean {
    const d = this.parseDueDate(this.dueDateText);
    if (!d) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }

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

  private nextSubtaskId(): number {
    let max = 0;
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id > max) max = this.subtasks[i].id;
    }
    return max + 1;
  }
}
