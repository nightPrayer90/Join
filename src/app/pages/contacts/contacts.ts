import { Component, computed, inject } from '@angular/core';
import { Supabase } from '../../service/supabase';
import { ContactsModel } from '../../shared/models/contacts-model';

type GroupedContacts = {
  letter: string;
  contacts: ContactsModel[];
};

@Component({
  selector: 'app-contacts',
  imports: [],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts {
  dbService = inject(Supabase);

  contactsByLetter = computed<GroupedContacts[]>(() => {
    
    const sortedContacts = [...this.dbService.contactsList()]
    .map(c => new ContactsModel(c))
    .sort((a, b) => {
      const fullNameA = this.fullNameFrom(a);
      const fullNameB = this.fullNameFrom(b);
      return fullNameA.localeCompare(fullNameB, 'de', { sensitivity: 'base' });
    });

    const grouped = new Map<string, ContactsModel[]>();

    
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


  fullNameFrom(contact: ContactsModel): string {
    return contact.full_name.trim();
  }

  // Schnittstelle für die Detail Ansicht
  openContactDetails(id: number) {
    // Aktualisiert das Datenbank Signal 
    this.dbService.getContactDetails(id);

    // Datanbanksignal für die Weiterververarbeitung -> ist Datenbank sync
    console.log(this.dbService.contactDetails());
  }
}
