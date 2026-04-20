import { Component, computed, inject } from '@angular/core';
import { Supabase } from '../../service/supabase';
import { Contact } from '../../shared/interface/contact';

type GroupedContacts = {
  letter: string;
  contacts: Contact[];
};

@Component({
  selector: 'app-contacts',
  imports: [],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts {
  private dbService = inject(Supabase);

  private fullNameFrom(contact: Contact): string {
    return contact.full_name.trim();
  }

  contactsByLetter = computed<GroupedContacts[]>(() => {
    const sortedContacts = [...this.dbService.contacts()].sort((a, b) => {
      const fullNameA = this.fullNameFrom(a);
      const fullNameB = this.fullNameFrom(b);
      return fullNameA.localeCompare(fullNameB, 'de', { sensitivity: 'base' });
    });

    const grouped = new Map<string, Contact[]>();

    for (const contact of sortedContacts) {
      const fullName = this.fullNameFrom(contact);
      const firstLetter = (fullName.charAt(0) || '#').toUpperCase();

      if (!grouped.has(firstLetter)) {
        grouped.set(firstLetter, []);
      }

      grouped.get(firstLetter)?.push(contact);
    }

    return Array.from(grouped.entries()).map(([letter, contacts]) => ({ letter, contacts }));
  });

  constructor() {
    void this.dbService.getContacts();
  }

  getFullName(contact: Contact): string {
    return this.fullNameFrom(contact);
  }

  getInitials(contact: Contact): string {
    const parts = this.fullNameFrom(contact).split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return `${first}${second || first}`.toUpperCase();
  }
}
