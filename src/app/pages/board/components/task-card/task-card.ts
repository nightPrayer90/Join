import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BoardTask } from '../../data/board-task.types';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [],
  templateUrl: './task-card.html',
  styleUrl: './task-card.scss',
  host: {
    'role': 'button',
    'tabindex': '0',
    '(click)': 'cardClick.emit()',
    '(keydown.enter)': 'cardClick.emit()',
    '(keydown.space)': 'cardClick.emit()',
  },
})
export class TaskCard {
  @Input({ required: true }) task!: BoardTask;
  @Output() cardClick = new EventEmitter<void>();

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
}
