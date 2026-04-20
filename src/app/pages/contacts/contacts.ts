import { Component, computed, inject } from '@angular/core';
import { Supabase } from '../../service/supabase';

type ContactItem = {
  id: number;
  full_name: string;
  email: string;
  avatar_color: string;
};

type GroupedContacts = {
  letter: string;
  contacts: ContactItem[];
};

type RawContact = {
  id: number;
  full_name: string;
  email: string;
  avatar_color: string;
};

@Component({
  selector: 'app-contacts',
  imports: [],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts {
  private dbService = inject(Supabase);

  private fullNameFrom(contact: ContactItem): string {
    return contact.full_name.trim();
  }

  private mapToContactItem(contact: RawContact): ContactItem {
    return {
      id: contact.id,
      full_name: contact.full_name.trim(),
      email: contact.email,
      avatar_color: contact.avatar_color,
    };
  }

  contactsByLetter = computed<GroupedContacts[]>(() => {
    const mappedContacts = (this.dbService.contacts() as unknown as RawContact[]).map(contact =>
      this.mapToContactItem(contact)
    );

    const sortedContacts = [...mappedContacts].sort((a, b) => {
      const fullNameA = this.fullNameFrom(a);
      const fullNameB = this.fullNameFrom(b);
      return fullNameA.localeCompare(fullNameB, 'de', { sensitivity: 'base' });
    });

    const grouped = new Map<string, ContactItem[]>();

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

  getFullName(contact: ContactItem): string {
    return this.fullNameFrom(contact);
  }

  getInitials(contact: ContactItem): string {
    const parts = this.fullNameFrom(contact).split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return `${first}${second || first}`.toUpperCase();
  }
}
