import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../service/supabase';
import { ContactsModel } from '../../shared/models/contacts-model';
import { Subtask } from '../../shared/interface/tasks-interface';
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
  //#region SERVICE & HOST INJECTION ===============================================================
  /** Supabase service for contacts and task persistence. */
  dbService = inject(Supabase);

  /** Reference to the host element (used for click-outside detection). */
  private host = inject(ElementRef<HTMLElement>);
  //#endregion

  //#region FORM STATE — left column fields (Title / Description / Due date) =======================
  /** Bound to the "Title" input → see HTML: "Title". */
  title = '';

  /** Bound to the "Description" textarea → see HTML: "Description". */
  description = '';

  /** Bound to the "Due date" text input (dd/mm/yyyy) → see HTML: "Due date". */
  dueDateText = '';

  /** Whether the due-date field has been touched (used to delay error display). */
  dueDateTouched = false;

  /** Minimum date allowed in the native date picker (ISO format yyyy-mm-dd). */
  minDateISO = '';
  //#endregion

  //#region FORM STATE — right column fields (Priority / Category / Subtasks) ======================
  /** Selected priority: 1 = Urgent, 2 = Medium (default), 3 = Low → see HTML: "Priority". */
  priority: PriorityKey = 2;

  /** Selected category id (null = nothing chosen yet) → see HTML: "Category". */
  categoryId: number | null = null;

  /** Bound to the "Add new subtask" input → see HTML: "Subtasks". */
  subtaskInput = '';

  /** List of subtasks already added to this task. */
  subtasks: Subtask[] = [];

  /** Id of the subtask currently in edit mode (null = none). */
  editingSubtaskId: number | null = null;

  /** Bound to the input field while editing a subtask. */
  editSubtaskInput = '';
  //#endregion

  //#region UI STATE — dropdowns, validation flags, save state =====================================
  /** Whether the "Assigned to" dropdown is open. */
  assignedOpen = false;

  /** Current search text inside the "Assigned to" input. */
  assignedSearch = '';

  /** Whether the "Category" dropdown is open. */
  categoryOpen = false;

  /** True after the user pressed "Create Task" at least once (enables validation messages). */
  submitted = false;

  /** Error message shown if saving the task fails. */
  saveError = '';

  /** True while a save request is in flight (disables the submit button). */
  isSaving = signal(false);

  /** Controls visibility of the "Task added to board" toast. */
  showToast = signal(false);

  /** Ids of contacts currently selected in the "Assigned to" multi-select. */
  selectedMemberIds = signal<number[]>([]);

  /** Active timeout id for auto-hiding the toast. */
  private toastTimeoutId: number | null = null;
  //#endregion

  //#region STATIC OPTIONS =========================================================================
  /** Available categories shown in the "Category" dropdown. */
  readonly categories = CategoryModel.LIST;
  //#endregion

  //#region COMPUTED SIGNALS =======================================================================
  /**
   * Maps the selected member ids back to full contact objects.
   * Used in HTML: "Assigned to: Selected contacts shown as colored avatar chips".
   */
  selectedContacts = computed(() => {
    const ids = this.selectedMemberIds();
    const contacts = this.dbService.contactsList();
    const selected: ContactsModel[] = [];
    for (let i = 0; i < contacts.length; i++) {
      if (ids.includes(contacts[i].id)) selected.push(contacts[i]);
    }
    return selected;
  });
  //#endregion

  //#region LIFECYCLE ==============================================================================
  /**
   * Loads contacts and computes today's ISO date as the minimum due date.
   */
  ngOnInit(): void {
    this.dbService.getContacts();
    const today = new Date();
    const month = `${today.getMonth() + 1}`.padStart(2, '0');
    const day = `${today.getDate()}`.padStart(2, '0');
    this.minDateISO = `${today.getFullYear()}-${month}-${day}`;
  }

  /**
   * Clears any pending toast timeout when the component is destroyed.
   */
  ngOnDestroy(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
  }
  //#endregion

  //#region GLOBAL CLICK HANDLER (close dropdowns when clicking outside) ===========================
  /**
   * Closes the "Assigned to" or "Category" dropdown when the user clicks outside of them.
   * Affects HTML areas: "Assigned to" and "Category".
   * @param event - Document-level mouse click event
   */
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
  //#endregion

  //#region PRIORITY (Urgent / Medium / Low) =======================================================
  /**
   * Sets the task priority.
   * Used in HTML: "Priority option: Urgent / Medium / Low".
   * @param priority - 1 = Urgent, 2 = Medium, 3 = Low
   */
  setPriority(priority: PriorityKey): void {
    this.priority = priority;
  }
  //#endregion

  //#region ASSIGNED TO — dropdown open/close ======================================================
  /**
   * Toggles the "Assigned to" dropdown via the arrow icon.
   * Used in HTML: "Assigned to: Input field with arrow".
   * @param event - Click event (propagation stopped to avoid the document listener)
   */
  toggleAssignedDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.assignedOpen = !this.assignedOpen;
    if (!this.assignedOpen) this.assignedSearch = '';
    this.categoryOpen = false;
  }

  /**
   * Opens the "Assigned to" dropdown when the user clicks into the input.
   * Used in HTML: "Assigned to: Input field with arrow".
   * @param event - Click event
   */
  openAssignedDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.assignedOpen = true;
    this.categoryOpen = false;
  }
  //#endregion

  //#region ASSIGNED TO — input value & search filter ==============================================
  /**
   * Returns the value displayed inside the "Assigned to" input.
   * While the dropdown is open: shows the current search text.
   * While closed: shows the placeholder text.
   * Used in HTML: "Assigned to: Input field with arrow".
   */
  assignedInputValue(): string {
    if (this.assignedOpen) return this.assignedSearch;
    return 'Select contacts to assign';
  }

  /**
   * Updates the search query as the user types in the "Assigned to" input.
   * Used in HTML: "Assigned to: Input field with arrow".
   * @param event - Native input event
   */
  onAssignedInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.assignedSearch = input.value;
    this.assignedOpen = true;
    this.categoryOpen = false;
  }

  /**
   * Filters the contact list by the first letter of any name part.
   * Returns all contacts when the search is empty.
   * Used in HTML: "Assigned to: Dropdown list of contacts".
   */
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
  //#endregion

  //#region ASSIGNED TO — member selection (checkboxes) ============================================
  /**
   * Checks whether a contact is currently selected.
   * Used in HTML: "Custom checkbox" inside each contact row.
   * @param id - Contact id
   */
  isMemberSelected(id: number): boolean {
    return this.selectedMemberIds().includes(id);
  }

  /**
   * Adds or removes a contact from the selected members list.
   * Used in HTML: "Custom checkbox" inside each contact row.
   * @param id - Contact id
   */
  toggleMember(id: number): void {
    const current = this.selectedMemberIds();
    if (current.includes(id)) {
      this.selectedMemberIds.set(current.filter((memberId) => memberId !== id));
      return;
    }
    this.selectedMemberIds.set([...current, id]);
  }
  //#endregion

  //#region ASSIGNED TO — contact display helpers (initials + name) ================================
  /**
   * Returns the contact name with "(You)" suffix when the contact's email
   * matches the currently logged-in user.
   * Used in HTML: "Contact info: avatar + name".
   * @param fullName - Contact full name
   * @param email - Contact email
   */
  contactDisplayName(fullName: string, email: string): string {
    const currentEmail = this.dbService.user()?.email?.toLowerCase() ?? '';
    if (currentEmail && currentEmail === email.toLowerCase()) return `${fullName} (You)`;
    return fullName;
  }

  /**
   * Builds the two-letter avatar initials (first + last name initial).
   * Used in HTML: "Contact info: avatar + name" and "Selected avatar chips".
   * @param fullName - Contact full name
   */
  contactInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0).toUpperCase() ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : first;
    return `${first}${last}`;
  }
  //#endregion

  //#region CATEGORY ===============================================================================
  /**
   * Toggles the "Category" dropdown open/closed.
   * Used in HTML: "Category: Input field with arrow".
   * @param event - Click event
   */
  toggleCategoryDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.categoryOpen = !this.categoryOpen;
    this.assignedOpen = false;
  }

  /**
   * Returns the label of the currently selected category, or '' if none.
   * Used in HTML: "Category: Input field with arrow" (input value).
   */
  categoryLabel(): string {
    return CategoryModel.findById(this.categoryId)?.name ?? '';
  }

  /**
   * Selects a category and closes the dropdown.
   * Used in HTML: "Category: Dropdown list".
   * @param value - Selected category option
   */
  selectCategory(value: CategoryModel): void {
    this.categoryId = value.id;
    this.categoryOpen = false;
  }
  //#endregion

  //#region SUBTASKS — input field actions =========================================================
  /**
   * Returns true if the subtask input contains non-whitespace text.
   * Used in HTML: "Subtask input action buttons" (visibility).
   */
  hasSubtaskInput(): boolean {
    return !!this.subtaskInput.trim();
  }

  /**
   * Clears the subtask input field (× button).
   * Used in HTML: "Subtask input action buttons".
   */
  clearSubtaskInput(): void {
    this.subtaskInput = '';
  }

  /**
   * Adds the current input as a new subtask (✓ button or Enter key).
   * Used in HTML: "Subtask input action buttons" and "Subtask: Input".
   */
  addSubtask(): void {
    const title = this.subtaskInput.trim();
    if (!title) return;
    this.subtasks.push({ id: this.nextSubtaskId(), title, done: false });
    this.subtaskInput = '';
  }

  /**
   * Handles Enter key in the subtask input.
   * Used in HTML: "Subtask: Input".
   * @param event - Keyboard event
   */
  onSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.addSubtask();
  }
  //#endregion

  //#region SUBTASKS — list item actions (edit / delete) ===========================================
  /**
   * Removes a subtask by id and exits edit mode if it was being edited.
   * Used in HTML: "Delete button (trash icon)".
   * @param id - Subtask id
   */
  removeSubtask(id: number): void {
    this.subtasks = this.subtasks.filter((subtask) => subtask.id !== id);
    if (this.editingSubtaskId === id) this.cancelEditSubtask();
  }

  /**
   * Switches a subtask into edit mode (pencil icon).
   * Used in HTML: "Edit button (pencil icon)".
   * @param subtask - Subtask to edit
   */
  startEditSubtask(subtask: Subtask): void {
    this.editingSubtaskId = subtask.id;
    this.editSubtaskInput = subtask.title;
  }

  /**
   * Exits edit mode without saving (× button while editing).
   * Used in HTML: "Subtask in EDIT mode".
   */
  cancelEditSubtask(): void {
    this.editingSubtaskId = null;
    this.editSubtaskInput = '';
  }

  /**
   * Saves the edited subtask title (✓ button while editing).
   * Used in HTML: "Subtask in EDIT mode".
   */
  saveEditedSubtask(): void {
    const id = this.editingSubtaskId;
    const title = this.editSubtaskInput.trim();
    if (id === null || !title) return;
    this.subtasks = this.subtasks.map((subtask) =>
      subtask.id === id ? { ...subtask, title } : subtask,
    );
    this.cancelEditSubtask();
  }

  /**
   * Handles Enter key while editing a subtask.
   * Used in HTML: "Subtask in EDIT mode".
   * @param event - Keyboard event
   */
  onEditSubtaskEnter(event: Event): void {
    event.preventDefault();
    this.saveEditedSubtask();
  }

  /**
   * Returns the next available subtask id (max existing id + 1).
   */
  private nextSubtaskId(): number {
    let maxId = 0;
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id > maxId) maxId = this.subtasks[i].id;
    }
    return maxId + 1;
  }
  //#endregion

  //#region DUE DATE — input formatting & native picker ============================================
  /**
   * Marks the due-date field as touched so validation errors may appear.
   * Used in HTML: "Due date" input (blur event).
   */
  onDueDateBlur(): void {
    this.dueDateTouched = true;
  }

  /**
   * Auto-formats the typed date into "dd/mm/yyyy" while the user types.
   * Used in HTML: "Due date" input (input event).
   * @param event - Native input event
   */
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
   * Used in HTML: "Due date" calendar icon.
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
   * Reacts to the native date picker selection and converts the
   * yyyy-mm-dd value into the visible dd/mm/yyyy text.
   * Used in HTML: hidden native date input.
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
  //#endregion

  //#region DUE DATE — validation ==================================================================
  /**
   * Whether the due-date error message should currently be displayed.
   * Used in HTML: "Due date" error message.
   */
  showDateError(): boolean {
    return this.dueDateTouched && this.isDueDateInvalid();
  }

  /**
   * Returns the appropriate error message for the due-date field.
   * Used in HTML: "Due date" error message.
   */
  dueDateErrorMessage(): string {
    if (!this.dueDateText.trim()) return 'This field is required';
    return 'Due date cannot be in the past';
  }

  /**
   * Returns true if the due date is missing or before today.
   */
  private isDueDateInvalid(): boolean {
    const date = this.parseDueDate(this.dueDateText);
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  /**
   * Parses a date string in "dd/mm/yyyy", "dd.mm.yyyy", "dd-mm-yyyy"
   * or "yyyy-mm-dd" format. Returns null on invalid input.
   * @param value - Raw date string
   */
  private parseDueDate(value: string): Date | null {
    const normalized = value.trim();
    if (!normalized) return null;

    const ddmmyyyy = normalized.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (ddmmyyyy) {
      const day = Number(ddmmyyyy[1]);
      const month = Number(ddmmyyyy[2]);
      const year = Number(ddmmyyyy[3]);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
        return null;
      date.setHours(0, 0, 0, 0);
      return date;
    }

    const yyyymmdd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!yyyymmdd) return null;
    const year = Number(yyyymmdd[1]);
    const month = Number(yyyymmdd[2]);
    const day = Number(yyyymmdd[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
      return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }
  //#endregion

  //#region FORM VALIDATION (Title / Category) =====================================================
  /**
   * Whether a required field should currently be displayed as invalid.
   * Used in HTML: "Title" and "Category" fields.
   * @param field - Field name
   */
  isFieldInvalid(field: 'title' | 'category'): boolean {
    if (!this.submitted) return false;
    if (field === 'title') return !this.title.trim();
    return this.categoryId === null;
  }

  /**
   * Returns true if all required fields are filled and the due date is valid.
   */
  private isFormValid(): boolean {
    return !!this.title.trim() && this.categoryId !== null && !this.isDueDateInvalid();
  }
  //#endregion

  //#region FORM ACTIONS (Create / Clear) ==========================================================
  /**
   * Validates the form and saves the new task to the database.
   * On success: clears the form and shows the toast.
   * Used in HTML: "Submit button: creates the task in the database".
   */
  async createTask(): Promise<void> {
    this.submitted = true;
    this.dueDateTouched = true;
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

  /**
   * Resets the entire form to its initial empty state.
   * Used in HTML: "Clear button: resets the whole form".
   */
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
  //#endregion

  //#region TOAST NOTIFICATION =====================================================================
  /**
   * Shows the success toast and hides it again after 2.5 seconds.
   * Used in HTML: "TOAST NOTIFICATION".
   */
  private openToast(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
    this.showToast.set(true);
    this.toastTimeoutId = window.setTimeout(() => {
      this.showToast.set(false);
      this.toastTimeoutId = null;
    }, 2500);
  }
  //#endregion
}
