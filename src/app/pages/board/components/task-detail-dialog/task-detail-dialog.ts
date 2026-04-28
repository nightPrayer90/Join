import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { BoardTask } from '../../data/board-task.types';

@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [],
  templateUrl: './task-detail-dialog.html',
  styleUrl: './task-detail-dialog.scss',
})
export class TaskDetailDialog {
  @Input({ required: true }) task!: BoardTask;
  @Output() close = new EventEmitter<void>();

  readonly priorityLabels: Record<BoardTask['priority'], string> = {
    urgent: 'Urgent',
    medium: 'Medium',
    low: 'Low',
  };

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }

  onOverlayClick(): void {
    this.close.emit();
  }

  onCardClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
