import { Component, ElementRef, EventEmitter, HostListener, inject, Input, Output, signal } from '@angular/core';
import { BoardColumn, BoardStatus, BoardTask } from '../../data/board-task.types';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [],
  templateUrl: './task-card.html',
  styleUrl: './task-card.scss',
  host: {
    'role': 'button',
    'tabindex': '0',
    '(click)': 'onHostClick()',
    '(keydown.enter)': 'onHostActivate()',
    '(keydown.space)': 'onHostActivate()',
  },
})
export class TaskCard {
  @Input({ required: true }) task!: BoardTask;
  @Input() columns: BoardColumn[] = [];
  @Output() cardClick = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<BoardStatus>();

  private hostRef = inject(ElementRef);
  readonly menuOpen = signal(false);

  get doneSubtasks(): number {
    return this.task.subtasks.filter(s => s.done).length;
  }

  get totalSubtasks(): number {
    return this.task.subtasks.length;
  }

  get progressPercent(): number {
    if (!this.totalSubtasks) return 0;
    return (this.doneSubtasks / this.totalSubtasks) * 100;
  }

  get visibleAssignees() {
    return this.task.assignees.slice(0, 4);
  }

  get hiddenAssigneesCount(): number {
    return Math.max(0, this.task.assignees.length - 4);
  }

  onHostClick(): void {
    this.menuOpen.set(false);
    this.cardClick.emit();
  }

  onHostActivate(): void {
    this.menuOpen.set(false);
    this.cardClick.emit();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  selectStatus(event: Event, status: BoardStatus): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    if (status === this.task.status) return;
    this.statusChange.emit(status);
  }

  stopKey(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen()) this.menuOpen.set(false);
  }
}
