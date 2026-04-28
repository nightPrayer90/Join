import { Member, Subtask, Tasks } from '../interface/tasks-interface';

/**
 * TaskModel
 * -----------------------------------------------------------------------------
 * This model represents a Task inside the application and acts as a wrapper
 * around the raw data coming from Supabase.
 *
 * DATA HANDLING
 * -----------------------------------------------------------------------------
 * - The database (Supabase) stores the date as an ISO string.
 * - Internally, this model ALSO stores the date as a string (`_date`).
 * - Externally, you always work with a native JavaScript `Date` object.
 *
 * This is handled via getter/setter:
 *    - `task.date`        → returns a `Date`
 *    - `task.date = Date` → automatically converts to ISO string
 *    - `task.dateISO`     → gives you the raw string for DB operations
 *
 *
 * INITIALIZATION
 * -----------------------------------------------------------------------------
 * You can create a task with partial data (e.g. from Supabase):  Missing values will be filled with safe defaults.
 *    const task = new TaskModel(dataFromDB);
 *
 * USAGE EXAMPLES
 * -----------------------------------------------------------------------------
 * // Access date as real Date object
 * console.log(task.date);
 *
 * // Set a new date
 * task.date = new Date();
 *
 * // Get ISO string for saving to Supabase
 * console.log(task.dateISO);
 *
 * // Work with subtasks
 * console.log(task.completedSubtasks);
 *
 *
 * IMPORTANT NOTES
 * -----------------------------------------------------------------------------
 * - Never access `_date` directly outside this class!
 * - Always use `date` (getter/setter) for working with dates.
 * - Use `dateISO` when sending data back to Supabase.
 *
 */

export class TasksModel {
  id: number;
  title: string;
  description: string;
  private _date: string;
  priority: number;
  member: Member[];
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

  getCleanAddJson() {
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

  getCleanUpdateJson() {
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

  // subtask handling -----------------------------------------------------------------------------
  addSubtask(title: string) {
    this.subtasks.push({
      id: this.getNextSubtaskId(),
      title,
      done: false,
    });
  }

  removeSubtask(id: number) {
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id === id) {
        this.subtasks.splice(i, 1);
        return;
      }
    }
  }
  updateSubtaskTitle(id: number, title: string) {
    const subtask = this.findSubtask(id);
    if (!subtask) return;
    subtask.title = title;
  }

  updateSubtaskDone(id: number, done: boolean) {
    const subtask = this.findSubtask(id);
    if (!subtask) return;
    subtask.done = done;
  }

  private findSubtask(id: number): Subtask | undefined {
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id === id) return this.subtasks[i];
    }
    return undefined;
  }

  private getNextSubtaskId(): number {
    let maxId = 0;
    for (let i = 0; i < this.subtasks.length; i++) {
      if (this.subtasks[i].id > maxId) maxId = this.subtasks[i].id;
    }
    return maxId + 1;
  }

  getCompletedSubtasks(): number {
    let count = 0;
    for (const subtask of this.subtasks) {
      if (subtask.done) count++;
    }
    return count;
  }

  getSubtasksCount(): number {
    return this.subtasks.length;
  }

  // dateHandling ---------------------------------------------------------------------------------
  get date(): Date {
    return new Date(this._date);
  }

  set date(value: Date) {
    this._date = value.toISOString();
  }

  get dateISO(): string {
    return this._date;
  }

  isOverdue(): boolean {
    return this.date < new Date();
  }
}
