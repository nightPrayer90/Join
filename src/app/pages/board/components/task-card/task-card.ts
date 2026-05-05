import { Component, ElementRef, EventEmitter, HostListener, inject, Input, Output, signal } from '@angular/core';
import { BoardColumn, BoardStatus, BoardTask } from '../../data/board-task.types';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [],
  templateUrl: './task-card.html',
  styleUrl: './task-card.scss',
  // Host element acts as a button: clickable + keyboard-activatable
  host: {
    'role': 'button',
    'tabindex': '0',
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

  /** Emitted on card click → opens task detail */
  @Output() cardClick = new EventEmitter<void>();

  /** Emitted when user picks a new column in the move menu */
  @Output() statusChange = new EventEmitter<BoardStatus>();

  private hostRef = inject(ElementRef);

  /** Open/closed state of the move menu (HTML: "Move menu") */
  readonly menuOpen = signal(false);

  
    /** Number of completed subtasks */
  get doneSubtasks(): number {
    return this.task.subtasks.filter(s => s.done).length;
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


  /** Show max 4 avatars */
  get visibleAssignees() {
    return this.task.assignees.slice(0, 4);
  }

  /** Remaining count shown as "+N" overflow badge */
  get hiddenAssigneesCount(): number {
    return Math.max(0, this.task.assignees.length - 4);
  }

  //#region HOST INTERACTIONS ---------------------------------------------------------------------
  /** Click on card → close menu, open detail */
  onHostClick(): void {
    this.menuOpen.set(false);
    this.cardClick.emit();
  }

  /** Enter/Space on card → same as click */
  onHostActivate(): void {
    this.menuOpen.set(false);
    this.cardClick.emit();
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region MOVE MENU -----------------------------------------------------------------------------
  /** Toggle menu; stopPropagation prevents host click from firing */
  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  /** Pick target column; ignores selection of current status */
  selectStatus(event: Event, status: BoardStatus): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    if (status === this.task.status) return;
    this.statusChange.emit(status);
  }

  /** Prevent Enter/Space inside menu from bubbling to host */
  stopKey(event: Event): void {
    event.stopPropagation();
  }

  /** Close menu when clicking outside the card */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.menuOpen.set(false);
    }
  }

  /** Close menu on Escape */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) this.menuOpen.set(false);
  }
  //#endregion ------------------------------------------------------------------------------------
}