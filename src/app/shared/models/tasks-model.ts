import { Subtask, Tasks } from '../interface/tasks-interface';
import { CategoryModel } from './category-model';

/**
 * Represents a single task entity used in the application.
 *
 * This model acts as a wrapper around raw database data (e.g. from Supabase)
 * and provides helper methods for safe data handling and manipulation.
 *
 */

export class TasksModel {
  id: number;
  title: string;
  description: string;
  private _date: string;
  priority: number;
  member: number[];
  category: number;
  subtasks: Subtask[];
  task_status: string;
  sort_order: number;

  /** Builds a TasksModel from a partial database record, applying defaults for missing fields. */
  constructor(data: Partial<Tasks> = {}) {
    this.id = data.id ?? -1;
    this.title = data.title ?? 'n/a';
    this.description = data.description ?? '';
    this._date = data.date ?? new Date().toISOString();
    this.priority = data.priority ?? 0;
    this.member = data.member ?? [];
    this.category = data.category ?? 0;
    this.subtasks = data.subtasks ?? [];
    this.task_status = data.task_status ?? 'todo';
    this.sort_order = data.sort_order ?? 0;
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
      task_status: this.task_status,
      sort_order: this.sort_order,
    };
  }

  /**
   * Returns a clean JSON object for updating a task in the database.
   * @returns {object} Task payload for update operations
   */
  getCleanUpdateJson(): object {
    return this.getCleanAddJson();
  }

  //#region CATEGORY HANDLING ---------------------------------------------------------------------
  /**
   * Resolves the task's category id into a full CategoryModel object.
   * @returns The CategoryModel or null if the id is invalid
   */
  getCategory(): CategoryModel | null {
    return CategoryModel.findById(this.category);
  }
  //#endregion

  //#region MEMBER HANDLING (not in use) ----------------------------------------------------------
  /** Adds a member to the task if not already assigned. */
  addMember(contactId: number): void {
    if (!this.hasMember(contactId)) this.member.push(contactId);
  }

  /** Removes a member from the task. */
  deleteMember(contactId: number): void {
    this.member = this.member.filter((id) => id !== contactId);
  }

  /** Checks if a member is assigned to the task. */
  hasMember(contactId: number): boolean {
    return this.member.includes(contactId);
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region SUBTASK HANDLING-----------------------------------------------------------------------
  /** Adds a new subtask. */
  addSubtask(title: string, isDone: boolean = false) {
    this.subtasks.push({ id: this.getNextSubtaskId(), title, done: isDone });
  }

  /** Removes a subtask by ID. */
  removeSubtask(id: number) {
    this.subtasks = this.subtasks.filter((s) => s.id !== id);
  }

  /** Updates the title of a subtask. */
  updateSubtaskTitle(id: number, title: string) {
    const subtask = this.findSubtask(id);
    if (subtask) subtask.title = title;
  }

  /** Updates the completion state of a subtask. */
  updateSubtaskDone(id: number, isDone: boolean) {
    const subtask = this.findSubtask(id);
    if (subtask) subtask.done = isDone;
  }

  /** Returns the number of completed subtasks. */
  getCompletedSubtasks(): number {
    return this.subtasks.filter((s) => s.done).length;
  }

  /** Returns the total number of subtasks. */
  getSubtasksCount(): number {
    return this.subtasks.length;
  }

  /** Finds a subtask by ID. */
  private findSubtask(id: number): Subtask | null {
    return this.subtasks.find((s) => s.id === id) ?? null;
  }

  /** Generates the next subtask ID (max existing + 1). */
  private getNextSubtaskId(): number {
    if (!this.subtasks.length) return 1;
    return Math.max(...this.subtasks.map((s) => s.id)) + 1;
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region DATE HELPERS --------------------------------------------------------------------------
  /** Returns the task date as a native Date object. */
  get date(): Date {
    return new Date(this._date);
  }

  /** Sets the task date (automatically converts to ISO string). */
  set date(value: Date) {
    this._date = value.toISOString();
  }

  /** Returns the raw ISO date string. */
  get dateISO(): string {
    return this._date;
  }

  /** Parses a date string in "dd/mm/yyyy", "dd.mm.yyyy", "dd-mm-yyyy" * or "yyyy-mm-dd" format. */
  static parseDate(date: string): Date | null {
    const normalized = date.trim();
    if (!normalized) return null;

    const ddmmyyyy = normalized.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (ddmmyyyy) return this.getEuropeanDate(ddmmyyyy);

    const yyyymmdd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) return this.getISODate(yyyymmdd);
    return null;
  }

  /** Returns a Date string from European Date */
  static getEuropeanDate(ddmmyyyy:RegExpMatchArray): Date | null {
      const day = Number(ddmmyyyy[1]);
      const month = Number(ddmmyyyy[2]);
      const year = Number(ddmmyyyy[3]);
      return this.buildDate(year, month, day);
  }

  /** Returns a Date string from ISO Date */
  static getISODate(yyyymmdd:RegExpMatchArray): Date | null {
      const year = Number(yyyymmdd[1]);
      const month = Number(yyyymmdd[2]);
      const day = Number(yyyymmdd[3]);
      return this.buildDate(year, month, day);
  }

  /** Build a Date string - Returns null on invalid input. */
  static buildDate(year: number, month: number, day: number): Date | null {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
      return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /** Returns true if the given date string is missing or before today. */
  static isDueDateInvalid(dateValue: string): boolean {
    const date = TasksModel.parseDate(dateValue);
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  /** Returns today's date as ISO string (yyyy-mm-dd) for date picker min attribute. */
  static todayISO(): string {
    const t = new Date();
    const m = `${t.getMonth() + 1}`.padStart(2, '0');
    const d = `${t.getDate()}`.padStart(2, '0');
    return `${t.getFullYear()}-${m}-${d}`;
  }

  /** Returns the date formatted as DD/MM/YYYY for display purposes. */
  get dateDisplay(): string {
    if (!this._date) return '';
    const d = new Date(this._date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }
  //#endregion
}