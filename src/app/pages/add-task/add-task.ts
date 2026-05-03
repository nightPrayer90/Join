import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../service/supabase';
import { ContactsModel } from '../../shared/models/contacts-model';
import { TasksModel } from '../../shared/models/tasks-model';
import { CategoryModel } from '../../shared/models/category-model';

type PriorityKey = 1 | 2 | 3;

@Component({
  selector: 'app-add-task',
  imports: [CommonModule, FormsModule],
  templateUrl: './add-task.html',
  styleUrl: './add-task.scss',
})
export class AddTask implements OnInit, OnDestroy {
  dbService = inject(Supabase);
  readonly categories = CategoryModel.LIST;
  private host = inject(ElementRef<HTMLElement>);

  // Form fields
  title = '';
  description = '';
  dueDateText = '';
  dueDateTouched = false;
  minDateISO = '';
  priority: PriorityKey = 2;
  categoryId: number | null = null;
  subtaskInput = '';
  editSubtaskInput = '';
  editingSubtaskId: number | null = null;
  draftTask = new TasksModel();

  // UI state — dropdowns, validation, save flags
  assignedOpen = false;
  assignedSearch = '';
  categoryOpen = false;
  submitted = false;
  saveError = '';
  private toastTimeoutId: number | null = null;

  // Signals
  isSaving = signal(false);
  showToast = signal(false);
  selectedMemberIds = signal<number[]>([]);

  /** Resolves selected member ids to full contact objects. */
  selectedContacts = computed(() => {
    const ids = this.selectedMemberIds();
    return this.dbService.contactsList().filter((c) => ids.includes(c.id));
  });

  //#region LIFECYCLE -----------------------------------------------------------------------------
  /** Computes today's ISO date as the minimum due date. */
  ngOnInit(): void {
    this.minDateISO = TasksModel.todayISO();
  }

  /** Clears any pending toast timeout when the component is destroyed. */
  ngOnDestroy(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
  }
  /** Click event - Closes the "Assigned to" or "Category" dropdown when the user clicks outside of them. ("Assigned to" and "Category") */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.host.nativeElement.contains(target)) return;

    const insideAssigned = !!target.closest('.assigned-select');
    const insideCategory = !!target.closest('.category-select');
    if (!insideAssigned) {
      this.assignedOpen = false;
      this.assignedSearch = '';
    }
    if (!insideCategory) this.categoryOpen = false;
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region MEMBER SELECTION ----------------------------------------------------------------------
  /**
   * Returns the value displayed inside the "Assigned to" input. (Assigned to: Input field with arrow)
   * While the dropdown is open: shows the current search text.
   * While closed: shows the placeholder text.
   */
  assignedInputValue(): string {
    if (this.assignedOpen) return this.assignedSearch;
    return 'Select contacts to assign';
  }

  /** Click event - Toggles the "Assigned to" dropdown via the arrow icon. (Assigned to: Input field with arrow) */
  toggleAssignedDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.assignedOpen = !this.assignedOpen;
    if (!this.assignedOpen) this.assignedSearch = '';
    this.categoryOpen = false;
  }

  /** Click event - Opens the "Assigned to" dropdown when the user clicks into the input. (Assigned to: Input field with arrow) */
  openAssignedDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.assignedOpen = true;
    this.categoryOpen = false;
  }

  /** Native input event - Updates the search query as the user types in the "Assigned to" input. (Assigned to: Input field with arrow) */
  onAssignedInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.assignedSearch = input.value;
    this.assignedOpen = true;
    this.categoryOpen = false;
  }

  /** Filters the contact list by the first letter of any name part. (Assigned to: Dropdown list of contacts) */
  filteredAssignedContacts(): ContactsModel[] {
    const query = this.assignedSearch.trim().toLowerCase();
    const contacts = this.dbService.contactsList();
    if (!query) return contacts;
    const letter = query.charAt(0);
    return contacts.filter((contact) => {
      const words = contact.full_name.trim().toLowerCase().split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i++) {
        if (words[i].charAt(0) === letter) return true;
      }
      return false;
    });
  }

  /** Checks whether a contact is currently selected. */
  isMemberSelected(contactId: number): boolean {
    return this.selectedMemberIds().includes(contactId);
  }

  /** Adds or removes a contact from the selected members list. */
  toggleMember(contactId: number): void {
    const current = this.selectedMemberIds();
    if (current.includes(contactId)) {
      this.selectedMemberIds.set(current.filter((memberId) => memberId !== contactId));
      return;
    }
    this.selectedMemberIds.set([...current, contactId]);
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region CATEGORY ------------------------------------------------------------------------------
  /** Click event - Toggles the "Category" dropdown open/closed. */
  toggleCategoryDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.categoryOpen = !this.categoryOpen;
    this.assignedOpen = false;
  }

  /** Returns the label of the currently selected category, or '' if none. */
  categoryLabel(): string {
    return CategoryModel.findById(this.categoryId)?.name ?? '';
  }

  /** Selects a category and closes the dropdown. */
  selectCategory(categoryOption: CategoryModel): void {
    this.categoryId = categoryOption.id;
    this.categoryOpen = false;
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region SUBTASKS ------------------------------------------------------------------------------
  /** Returns true if the subtask input contains non-whitespace text. */
  hasSubtaskInput(): boolean {
    return !!this.subtaskInput.trim();
  }

  /** Clears the subtask input field (× button). */
  clearSubtaskInput(): void {
    this.subtaskInput = '';
  }

  /** Adds the current input as a new subtask (✓ button or Enter key). */
  addSubtask(): void {
    const title = this.subtaskInput.trim();
    if (!title) return;
    this.draftTask.addSubtask(title);
    this.subtaskInput = '';
  }

  /** Keyboard event - Handles Enter key in the subtask input. */
  onSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.addSubtask();
  }

  /** Removes a subtask by id and exits edit mode if it was being edited. (Delete button (trash icon)) */
  removeSubtask(subtaskId: number): void {
    this.draftTask.removeSubtask(subtaskId);
    if (this.editingSubtaskId === subtaskId) this.cancelEditSubtask();
  }

  /** Switches a subtask into edit mode (Edit button (pencil icon)). */
  startEditSubtask(subtaskId: number, subtaskTitle: string): void {
    this.editingSubtaskId = subtaskId;
    this.editSubtaskInput = subtaskTitle;
  }

  /** Exits edit mode without saving (× button while editing). */
  cancelEditSubtask(): void {
    this.editingSubtaskId = null;
    this.editSubtaskInput = '';
  }

  /** Saves the edited subtask title (✓ button while editing). */
  saveEditedSubtask(): void {
    const id = this.editingSubtaskId;
    const title = this.editSubtaskInput.trim();
    if (id === null || !title) return;
    this.draftTask.updateSubtaskTitle(id, title);
    this.cancelEditSubtask();
  }

  /** Keyboard event - Handles Enter key while editing a subtask. */
  onEditSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.saveEditedSubtask();
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region DUE DATE ------------------------------------------------------------------------------
  /** Marks the due-date field as touched so validation errors may appear. */
  onDueDateBlur(): void {
    this.dueDateTouched = true;
  }

  /** Native input event - Auto-formats the typed date into "dd/mm/yyyy" while the user types. */
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

  /**
   * Opens the native date picker (calendar icon button).
   * @param dateInput - Hidden native date input element
   */
  openDatePicker(dateInput: HTMLInputElement): void {
    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
      return;
    }
    dateInput.click();
  }

  /**
   * Reacts to the native date picker selection and converts the yyyy-mm-dd value into the visible dd/mm/yyyy text.
   * @param event - Change event from the native date picker
   */
  onDatePickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) return;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return;
    this.dueDateText = `${match[3]}/${match[2]}/${match[1]}`;
    this.dueDateTouched = true;
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region FORM VALIDATION -----------------------------------------------------------------------
  /** Whether a required field should currently be displayed as invalid. (Title" and "Category) */
  isFieldInvalid(field: 'title' | 'category'): boolean {
    if (!this.submitted) return false;
    if (field === 'title') return !this.title.trim();
    return this.categoryId === null;
  }

  /** Returns true if all required fields are filled and the due date is valid. */
  private isFormValid(): boolean {
    return (
      !!this.title.trim() &&
      this.categoryId !== null &&
      !TasksModel.isDueDateInvalid(this.dueDateText)
    );
  }

  /** Whether the due-date error message should currently be displayed. */
  showDateError(): boolean {
    return this.dueDateTouched && TasksModel.isDueDateInvalid(this.dueDateText);
  }

  /** Returns the appropriate error message for the due-date field. */
  dueDateErrorMessage(): string {
    if (!this.dueDateText.trim()) return 'This field is required';
    return 'Due date cannot be in the past';
  }
  //#endregion

  //#region FORM ACTIONS --------------------------------------------------------------------------
  /** Validates the form and saves the new task to the database. ("Submit button: creates the task in the database) */
  async createTask(): Promise<void> {
    this.submitted = true;
    this.dueDateTouched = true;
    this.saveError = '';
    if (!this.isFormValid()) return;

    const task = this.buildTaskFromForm();
    if (!task) return;

    this.isSaving.set(true);
    const taskId = await this.dbService.addTask(task);
    this.isSaving.set(false);
    this.handleSaveResult(taskId);
  }

  /** Builds a TasksModel from the current form state, or null if date is invalid. */
  private buildTaskFromForm(): TasksModel | null {
    const dueDate = TasksModel.parseDate(this.dueDateText);
    if (!dueDate) return null;
    return new TasksModel({
      title: this.title.trim(),
      description: this.description.trim(),
      priority: this.priority,
      member: [...this.selectedMemberIds()],
      category: this.categoryId ?? 0,
      subtasks: [...this.draftTask.subtasks],
      task_status: 'todo',
      sort_order: 0,
      date: dueDate.toISOString(),
    });
  }

  /** Handles the result of the save attempt — either resets the form or shows an error. */
  private handleSaveResult(taskId: number | null): void {
    if (taskId === null) {
      this.saveError = 'Task could not be saved. Please check your data and permissions.';
      return;
    }
    this.clearForm();
    this.submitted = false;
    this.openToast();
  }

  /** Resets the entire form to its initial empty state. */
  clearForm(): void {
    this.title = '';
    this.description = '';
    this.dueDateText = '';
    this.priority = 2;
    this.categoryId = null;
    this.subtaskInput = '';
    this.draftTask = new TasksModel();
    this.dueDateTouched = false;
    this.saveError = '';
    this.cancelEditSubtask();
    this.selectedMemberIds.set([]);
    this.assignedOpen = false;
    this.categoryOpen = false;
  }
  //#endregion ------------------------------------------------------------------------------------

  /** PRIORITY - Sets the task priority. (1 = Urgent, 2 = Medium, 3 = Low) */
  setPriority(priority: PriorityKey): void {
    this.priority = priority;
  }

  /** TOAST NOTIFICATION - Shows the success toast and hides it again after 2.5 seconds. */
  private openToast(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
    this.showToast.set(true);
    this.toastTimeoutId = window.setTimeout(() => {
      this.showToast.set(false);
      this.toastTimeoutId = null;
    }, 2500);
  }
}
