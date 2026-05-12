import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [],
  templateUrl: './legal-notice.html',
  styleUrl: './legal-notice.scss',
})
export class LegalNotice {
  private location = inject(Location);

  goBack(): void {
    this.location.back();
  }
}
