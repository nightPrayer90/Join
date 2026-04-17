import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Supabase } from './service/supabase';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  dbService: Supabase = inject(Supabase);
}
