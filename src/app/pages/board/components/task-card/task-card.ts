import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  Output,
} from '@angular/core';
import { BoardColumn, BoardStatus, BoardTask } from '../../data/board-task.types';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [],
  templateUrl: './task-card.html',
  styleUrl: './task-card.scss',
  // Host element acts as a button: clickable + keyboard-activatable
  host: {
    role: 'button',
    tabindex: '0',
    '(click)': 'onHostClick()',
    '(keydown.enter)': 'onHostActivate()',
    '(keydown.space)': 'onHostActivate()',
  },
})
export class TaskCard {
  /** Task rendered by this card (title, description, subtasks, assignees, priority) */
  @Input({ required: true }) task!: BoardTask;

  /** Available board columns — used by the "Move to" menu */
  @Input() columns: BoardColumn[] = [];

  /** Whether THIS card's move menu is currently open (controlled by parent) */
  @Input() menuOpen: boolean = false;

  /** Emitted on card click → opens task detail */
  @Output() cardClick = new EventEmitter<void>();

  /** Emitted when user picks a new column in the move menu */
  @Output() statusChange = new EventEmitter<BoardStatus>();

  /** Emitted when user toggles the move menu (parent decides which card stays open) */
  @Output() menuToggle = new EventEmitter<void>();

  /** Emitted when the menu should close (outside click / Escape / card click) */
  @Output() menuClose = new EventEmitter<void>();

  private hostRef = inject(ElementRef);

  /** Number of completed subtasks */
  get doneSubtasks(): number {
    return this.task.subtasks.filter((s) => s.done).length;
  }

  /** Total number of subtasks */
  get totalSubtasks(): number {
    return this.task.subtasks.length;
  }

  /** Completion ratio in percent (0 if no subtasks) */
  get progressPercent(): number {
    if (!this.totalSubtasks) return 0;
    return (this.doneSubtasks / this.totalSubtasks) * 100;
  }

  /** Show max 3 avatars */
  get visibleAssignees() {
    return this.task.assignees.slice(0, 3);
  }

  /** Remaining count shown as "+N" overflow badge */
  get hiddenAssigneesCount(): number {
    return Math.max(0, this.task.assignees.length - 3);
  }

  //#region HOST INTERACTIONS ---------------------------------------------------------------------
  /** Click on card → close menu, open detail */
  onHostClick(): void {
    if (this.menuOpen) this.menuClose.emit();
    this.cardClick.emit();
  }

  /** Enter/Space on card → same as click */
  onHostActivate(): void {
    if (this.menuOpen) this.menuClose.emit();
    this.cardClick.emit();
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region MOVE MENU -----------------------------------------------------------------------------
  /** Toggle menu; stopPropagation prevents host click from firing */
  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuToggle.emit();
  }

  /** Pick target column; ignores selection of current status */
  selectStatus(event: Event, status: BoardStatus): void {
    event.stopPropagation();
    this.menuClose.emit();
    if (status === this.task.status) return;
    this.statusChange.emit(status);
  }

  /** Prevent Enter/Space inside menu from bubbling to host */
  stopKey(event: Event): void {
    event.stopPropagation();
  }

  /** Returns the column's position index — used to compare order between two statuses. */
  getColumnOrder(status: BoardStatus): number {
    return this.columns.findIndex((c) => c.key === status);
  }

  /** Close menu when clicking outside the card */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen) return;
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.menuClose.emit();
    }
  }

  /** Close menu on Escape */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen) this.menuClose.emit();
  }
  //#endregion ------------------------------------------------------------------------------------
}
