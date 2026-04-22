import { Component, signal, computed, inject } from '@angular/core';
import { Supabase } from '../../service/supabase';
import { ContactsModel } from '../../shared/models/contacts-model';
import { ContactDialog } from './components/contact-dialog/contact-dialog';

type GroupedContacts = {
  letter: string;
  contacts: ContactsModel[];
};

@Component({
  selector: 'app-contacts',
  imports: [ContactDialog],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts {
  dbService: Supabase = inject(Supabase);
  detailsVisible = signal(false);
  dialogVisible = signal(false);
  dialogMode = signal<'add' | 'edit'>('add');
  showCreatedToast = signal(false);
  actionSheetOpen = signal(false);
  private createdToastTimeoutId: number | null = null;

  //#region contact list --------------------------------------------------------------------------
  contactsByLetter = computed<GroupedContacts[]>(() => {
    const sortedContacts = [...this.dbService.contactsList()]
      .map((c) => new ContactsModel(c))
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
  //#endregion ------------------------------------------------------------------------------------
  //#region contact details -----------------------------------------------------------------------
  openContactDetails(id: number): void {
    if (this.dbService.contactDetails()?.id === id) {
      return;
    }

    this.dbService.getContactDetails(id);
    this.detailsVisible.set(false);

    setTimeout(() => {
      this.detailsVisible.set(true);
    }, 10);
  }

  async deleteContact(id: number): Promise<void> {
    if (id < 0) return;

    await this.dbService.deleteContact(id);
    this.dbService.contactDetailsId.set(null);
    this.detailsVisible.set(false);
  }
  //#endregion

  //#region dialog control ------------------------------------------------------------------------
  // öffnen des dialoges im Edit modus
  editContactDialog(id: number): void {
    if (id < 0) return;
    this.dbService.getContactDetails(id);
    this.dialogMode.set('edit');
    this.dialogVisible.set(true);
  }

  // öffnen des dialoges im Add modus
  addContactDialog(): void {
    this.detailsVisible = signal(false);
    this.dbService.contactDetailsId.set(null);
    this.dialogMode.set('add');
    this.dialogVisible.set(true);
  }

  // Schließen Kreuz
  closeContactDialog(): void {
    this.dialogVisible.set(false);
  }

  // Schließen nach anlegen neuem Kontakt
  backToList(): void {
    this.detailsVisible.set(false);
    this.dbService.contactDetailsId.set(null);
  }

  onContactCreated(): void {
    if (this.createdToastTimeoutId !== null) {
      window.clearTimeout(this.createdToastTimeoutId);
      this.createdToastTimeoutId = null;
    }

    this.showCreatedToast.set(false);
    window.setTimeout(() => {
      this.showCreatedToast.set(true);
      this.createdToastTimeoutId = window.setTimeout(() => {
        this.showCreatedToast.set(false);
        this.createdToastTimeoutId = null;
      }, 2000);
    }, 0);
  }
  //#endregion ------------------------------------------------------------------------------------
  //#region ActionSheet ---------------------------------------------------------------------------
  // Resposive - EDIT - open dialog
  editFromSheet(): void {
    const id = this.dbService.contactDetails()?.id ?? -1;
    this.closeActionSheet();
    this.editContactDialog(id);
  }

  // Resposive - delete - open dialog
  deleteFromSheet(): void {
    const id = this.dbService.contactDetails()?.id ?? -1;
    this.closeActionSheet();
    this.deleteContact(id);
  }

  openActionSheet(): void {
    this.actionSheetOpen.set(true);
  }

  closeActionSheet(): void {
    this.actionSheetOpen.set(false);
  }
  //#endregion ------------------------------------------------------------------------------------
}
