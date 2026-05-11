import { Component, signal, computed, inject } from '@angular/core';
import { Supabase } from '../../service/supabase';
import { ContactsModel } from '../../shared/models/contacts-model';
import { ContactDialog } from './components/contact-dialog/contact-dialog';
import { StatusToast } from '../../shared/components/status-toast/status-toast';

type GroupedContacts = {
  letter: string;
  contacts: ContactsModel[];
};

@Component({
  selector: 'app-contacts',
  imports: [ContactDialog, StatusToast],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts {
  dbService: Supabase = inject(Supabase);
  detailsVisible = signal(false);
  dialogVisible = signal(false);
  dialogMode = signal<'add' | 'edit'>('add');
  showToast = signal(false);
  toastMessage = signal('');
  actionSheetOpen = signal(false);
  private toastTimeoutId: number | null = null;

  //#region contact list --------------------------------------------------------------------------
  /**
   * Computes and groups contacts alphabetically by their first letter.
   * Also sorts contacts by their full name using German locale rules.
   */
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

  /**
   * Returns the trimmed full name of a contact.
   * @param contact The contact model
   * @returns The formatted full name
   */
  fullNameFrom(contact: ContactsModel): string {
    return contact.full_name.trim();
  }

  /**
   * Returns the logged-in user's email for contact name highlighting.
   */
  currentUserEmail(): string | null {
    return this.dbService.user()?.email ?? null;
  }
  //#endregion ------------------------------------------------------------------------------------
  //#region contact details -----------------------------------------------------------------------
  // open contact from contact details
  /**
   * Opens the contact details view for a given contact ID.
   * Prevents reloading if the same contact is already selected.
   * @param id The contact ID
   */
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

  /**
   * Deletes a contact by ID and resets the current selection.
   * Shows a confirmation toast after deletion.
   * @param id The contact ID
   */
  async deleteContact(id: number): Promise<void> {
    if (id < 0) return;

    await this.dbService.deleteContact(id);
    this.dbService.getContactDetails(null);
    this.detailsVisible.set(false);
    this.triggerToast('Contact successfully deleted');
  }
  //#endregion

  //#region dialog control ------------------------------------------------------------------------
  /**
   * Opens the contact dialog in edit mode for a given contact.
   * @param id The contact ID
   */
  editContactDialog(id: number): void {
    if (id < 0) return;
    this.dbService.getContactDetails(id);
    this.dialogMode.set('edit');
    this.dialogVisible.set(true);
  }

  /**
   * Opens the contact dialog in add mode.
   * Resets current contact details.
   */
  addContactDialog(): void {
    this.detailsVisible = signal(false);
    this.dbService.getContactDetails(null);
    this.dialogMode.set('add');
    this.dialogVisible.set(true);
  }

  /**
   * Closes the contact dialog.
   */
  closeContactDialog(): void {
    this.dialogVisible.set(false);
  }

  /**
   * Handles creation of a new contact.
   * Sets the new contact as active and opens its details view.
   * @param id The newly created contact ID
   */
  onContactCreatedWithId(id: number): void {
    this.dbService.getContactDetails(id);
    this.detailsVisible.set(true);
    this.dialogVisible.set(false);
  }

  //#endregion ------------------------------------------------------------------------------------
  //#region toast control -------------------------------------------------------------------------
  /**
   * Handles UI feedback after a contact was updated.
   */
  onContactUpdated(): void {
    this.triggerToast('Contact successfully updated');
  }

  /**
   * Handles UI feedback after a contact was deleted.
   */
  onContactDeleted(): void {
    this.triggerToast('Contact successfully deleted');
  }

  /**
   * Handles UI feedback after a contact was created.
   */
  onContactCreated(): void {
    this.triggerToast('Contact successfully created');
  }

  /**
   * Displays a toast message for a short duration.
   * Ensures only one toast timeout is active at a time.
   * @param message The message to display
   */
  private triggerToast(message: string): void {
    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }

    this.showToast.set(false);
    this.toastMessage.set(message);
    window.setTimeout(() => {
      this.showToast.set(true);
      this.toastTimeoutId = window.setTimeout(() => {
        this.showToast.set(false);
        this.toastTimeoutId = null;
      }, 2000);
    }, 0);
  }
  //#endregion ------------------------------------------------------------------------------------
  //#region Responice ActionSheet -----------------------------------------------------------------
  /**
   * Opens the edit dialog from the action sheet.
   * Uses the currently selected contact.
   */
  editFromSheet(): void {
    const id = this.dbService.contactDetails()?.id ?? -1;
    this.closeActionSheet();
    this.editContactDialog(id);
  }

  /**
   * Deletes the currently selected contact from the action sheet.
   */
  deleteFromSheet(): void {
    const id = this.dbService.contactDetails()?.id ?? -1;
    this.closeActionSheet();
    this.deleteContact(id);
  }

  /**
   * Opens the responsive action sheet menu.
   */
  openActionSheet(): void {
    this.actionSheetOpen.set(true);
  }

  /**
   * Closes the responsive action sheet menu.
   */
  closeActionSheet(): void {
    this.actionSheetOpen.set(false);
  }

  /**
   * Navigates back to the contact list view.
   * Clears the selected contact.
   */
  backToList(): void {
    this.detailsVisible.set(false);
    this.dbService.getContactDetails(null);
  }
  //#endregion ------------------------------------------------------------------------------------
}
