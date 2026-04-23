import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-toast',
  imports: [],
  templateUrl: './status-toast.html',
  styleUrl: './status-toast.scss',
})
export class StatusToast {
  @Input() message: string = '';
}
