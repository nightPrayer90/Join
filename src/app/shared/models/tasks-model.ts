import { Subtask, Tasks } from '../interface/tasks-interface';

/**
 * Represents a single task entity used in the application.
 *
 * This model acts as a wrapper around raw database data (e.g. from Supabase)
 * and provides helper methods for safe data handling and manipulation.
 *
 * ---------------------------------------------------------------------------
 * DATE HANDLING
 * ---------------------------------------------------------------------------
 * - Internally, the date is stored as an ISO string (`_date`)
 * - Externally, the date is exposed as a native JavaScript `Date` object
 *
 * Access patterns:
 * - `task.date`        → returns a `Date`
 * - `task.date = Date` → converts to ISO string automatically
 * - `task.dateISO`     → raw string for database usage
 *
 * ---------------------------------------------------------------------------
 * INITIALIZATION
 * ---------------------------------------------------------------------------
 * The constructor accepts partial task data (e.g. from database responses).
 * Missing values are automatically filled with default values.
 *
 * @example
 * const task = new TasksModel(dataFromDB);
 *
 * ---------------------------------------------------------------------------
 * USAGE EXAMPLES
 * ---------------------------------------------------------------------------
 * @example
 * // Access date
 * console.log(task.date);
 *
 * @example
 * // Set date
 * task.date = new Date();
 *
 * @example
 * // Get ISO string for database
 * console.log(task.dateISO);
 *
 * @example
 * // Count completed subtasks
 * console.log(task.getCompletedSubtasks());
 */
export class TasksModel {
  id: number;
  title: string;
  description: string;
  private _date: string;
  priority: number;
  member: number[];
  category: string;
  subtasks: Subtask[];

  constructor(data: Partial<Tasks> = {}) {
    this.id = data.id ?? -1;
    this.title = data.title ?? 'n/a';
    this.description = data.description ?? '';
    this._date = data.date ?? new Date().toISOString();
    this.priority = data.priority ?? 0;
    this.member = data.member ?? [];
    this.category = data.category ?? 'general';
    this.subtasks = data.subtasks ?? [];
  }

  /**
   * Returns a clean JSON object for creating a task in the database.
   * @returns {object} Task payload for insert operations
   */
  getCleanAddJson(): object {
    return {
      title: this.title,
      description: this.description,
      date: this.dateISO,
      priority: this.priority,
      member: this.member,
      category: this.category,
      subtasks: this.subtasks,
    };
  }

  /**
   * Returns a clean JSON object for updating a task in the database.
   * @returns {object} Task payload for update operations
   */
  getCleanUpdateJson(): object {
    return this.getCleanAddJson();
  }

  //#region MEMBER HANDLING -----------------------------------------------------------------------
  /**
   * Adds a member to the task if not already assigned.
   * @param {number} contactId Member ID
   */
  addMember(contactId: number): void {
    if (!this.hasMember(contactId)) this.member.push(contactId);
  }

  /**
   * Removes a member from the task.
   * @param {number} contactId Member ID
   */
  deleteMember(contactId: number): void {
    for (let i = 0; i < this.member.length; i++) {
      if (this.member[i] === contactId) {
        this.member.splice(i, 1);
        return;
      }
    }
  }

  /**
   * Checks if a member is assigned to the task.
   * @param {number} contactId Member ID
   * @returns {boolean}
   */
  hasMember(contactId: number): boolean {
    return this.member.includes(contactId);
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region SUBTASK HANDLING-----------------------------------------------------------------------
  /**
   * Adds a new subtask.
   * @param {string} title Subtask title
   */
  addSubtask(title: string, isDone: boolean = false) {
    this.subtasks.push({
      id: this.getNextSubtaskId(),
      title,
      done: isDone,
    });
  }

  /**
   * Removes a subtask by ID.
   * @param {number} id Subtask ID
   */
  removeSubtask(id: number) {
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id === id) {
        this.subtasks.splice(i, 1);
        return;
      }
    }
  }

  /**
   * Updates the title of a subtask.
   * @param {number} id Subtask ID
   * @param {string} title New title
   */
  updateSubtaskTitle(id: number, title: string) {
    const subtask = this.findSubtask(id);
    if (!subtask) return;
    subtask.title = title;
  }

  /**
   * Updates the completion state of a subtask.
   * @param {number} id Subtask ID
   * @param {boolean} isDone Completion state
   */
  updateSubtaskDone(id: number, isDone: boolean) {
    const subtask = this.findSubtask(id);
    if (!subtask) return;
    subtask.done = isDone;
  }

  /**
   * Updates subtask.
   * @param {number} id Subtask ID
   * @param {string} title New title
   * @param {boolean} isDone Completion state
   */
  updateSubtask(id: number, title: string, isDone: boolean) {
    const subtask = this.findSubtask(id);
    if (!subtask) return;
    subtask.title = title;
    subtask.done = isDone;
  }

  /**
   * Returns the number of completed subtasks.
   * @returns {number}
   */
  getCompletedSubtasks(): number {
    let count = 0;
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].done) count++;
    }
    return count;
  }

  /**
   * Returns the total number of subtasks.
   * @returns {number}
   */
  getSubtasksCount(): number {
    return this.subtasks.length;
  }

  /**
   * Finds a subtask by ID.
   * @param {number} id Subtask ID
   * @returns {Subtask | null}
   */
  private findSubtask(id: number): Subtask | null {
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id === id) return this.subtasks[i];
    }
    return null;
  }

  /**
   * Generates the next subtask ID.
   * @returns {number}
   */
  private getNextSubtaskId(): number {
    let maxId = 0;
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id > maxId) maxId = this.subtasks[i].id;
    }
    return maxId + 1;
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region DATE HANDLING ---------------------------------------------------------------------------
  /**
   * Returns the task date as a JavaScript Date object.
   * @returns {Date}
   */
  get date(): Date {
    return new Date(this._date);
  }

  /**
   * Sets the task date (automatically converts to ISO string).
   * @param {Date} value
   */
  set date(value: Date) {
    this._date = value.toISOString();
  }

  /**
   * Returns the raw ISO date string.
   * @returns {string}
   */
  get dateISO(): string {
    return this._date;
  }

  /**
   * Checks whether the task is overdue.
   * @returns {boolean}
   */
  isOverdue(): boolean {
    return this.date < new Date();
  }
  //#endregion
}
