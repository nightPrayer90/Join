import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-discard-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-discard-dialog.html',
  styleUrl: './confirm-discard-dialog.scss',
})
export class ConfirmDiscardDialog {
  @Input() title = 'Discard changes?';
  @Input() message = 'Your unsaved changes will be lost.';
  @Input() confirmLabel = 'Discard';
  @Input() cancelLabel = 'Keep editing';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    this.cancel.emit();
  }

  onPanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  onConfirm(event: MouseEvent): void {
    event.stopPropagation();
    this.confirm.emit();
  }

  onCancel(event: MouseEvent): void {
    event.stopPropagation();
    this.cancel.emit();
  }
}
