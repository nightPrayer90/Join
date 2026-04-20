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
    
    const sortedContacts = [...this.dbService.contacts()]
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

  // -> die kette hier
  //    -> contacts aus der db wird sortiert und in ein compueted signal geparkt
  //    -> dieses signal wird in der html verarbeitet und läuft zurück hier in die funktion. 
  //    -> Frage, funktioniert dann die live aktuallisierung noch? das müssen wir noch herausfinden. evl - sonst über die ID direkt den Eintrag aus der Datenbank ziehen. 
  openContactDetails(contact: ContactsModel) {
    // contact.full_name;
    // contact.email;
    // contact.phone;

    console.log(contact);
  }
}
