import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [],
  templateUrl: './help.html',
  styleUrl: './help.scss',
})
export class Help {
  private location = inject(Location);

  goBack(): void {
    this.location.back();
  }
}
