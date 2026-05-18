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

  /** Treats the Escape key like cancelling the discard prompt. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel.emit();
  }

  /** Cancels the dialog when the user clicks on the surrounding overlay. */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    this.cancel.emit();
  }

  /** Prevents click events inside the panel from bubbling to the overlay. */
  onPanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /** Emits the confirm event when the user agrees to discard the changes. */
  onConfirm(event: MouseEvent): void {
    event.stopPropagation();
    this.confirm.emit();
  }

  /** Emits the cancel event when the user wants to keep editing. */
  onCancel(event: MouseEvent): void {
    event.stopPropagation();
    this.cancel.emit();
  }
}
