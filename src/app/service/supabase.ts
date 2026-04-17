import { Injectable, signal } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  supabaseUrl: string = 'https://guvsrmtryoljhhdpanat.supabase.co';
  supabaseKey: string = 'sb_publishable_pqmeYWYGduxCvtNhzM5HoA_oP6YdAqj';
  supabase = createClient(this.supabaseUrl, this.supabaseKey);

  contacts = signal<{id:number, created_at:string, first_name:string, last_name:string, email:string, phone:string; avatar_color:string}[]>([]);

  async getContact() {
    let { data: contacts, error } = await this.supabase.from('contacts').select('*');
    
    if(!contacts) return 

    this.contacts.set(contacts);
    console.log(contacts);
  }
}
