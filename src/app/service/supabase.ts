/**
 * Supabase Service (Singleton)
 * (providedIn: 'root')
 */

import { Injectable, signal, computed } from '@angular/core';
import { createClient, RealtimeChannel, Session, User } from '@supabase/supabase-js';
import { Contact } from '../shared/interface/contact-interface';
import { ContactsModel } from '../shared/models/contacts-model';

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  supabaseUrl: string = 'https://guvsrmtryoljhhdpanat.supabase.co';
  supabaseKey: string = 'sb_publishable_pqmeYWYGduxCvtNhzM5HoA_oP6YdAqj';
  supabase = createClient(this.supabaseUrl, this.supabaseKey);
  channels: RealtimeChannel | undefined;

  user = signal<User | null>(null);
  contactsList = signal<ContactsModel[]>([]);

  contactDetailsId = signal<number | null>(null);
  // Signal to Show Details bei ID
  contactDetails = computed<ContactsModel | null>(() => {
    const id = this.contactDetailsId();
    if (!id) return null;

    const list = this.contactsList();
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  });

  /**
   * Important:
   * - The constructor runs only ONCE during app lifetime
   * - It is triggered when the service is injected for the first time
   */
  constructor() {
    this.initAuthListener();
    this.subscripeChannel();
  }

  ngOnDestroy() {
    if (this.channels) this.supabase.removeChannel(this.channels);
  }

  //#region SERVICE INIT -------------------------------------------------------------------------
  /**
   * Initializes auth state listener.
   *
   * @see: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
   */
  private initAuthListener(): void {
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this.initUserIsLoggedIn(session);
      } else {
        this.initUserIsGuest();
      }
    });
  }

  /**
   * Handles initialization - user state.
   *
   * Sets the current user from the session and loads all user-related data.
   * This is triggered by the global auth state listener.
   */
  private initUserIsLoggedIn(session: Session): void {
    this.user.set(session.user);
    this.getContacts();
  }

  /**
   * Handles initialization - guest state.
   *
   * Clears the current user and resets all user-related data.
   * This is triggered by the global auth state listener.
   */
  private initUserIsGuest(): void {
    this.user.set(null);
    this.getContacts();
  }

  private subscripeChannel() {
    this.channels = this.supabase
      .channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            this.contactsList.update((list) => [
              ...list,
              new ContactsModel(payload.new as Contact),
            ]);
            break;

          case 'UPDATE':
            this.contactsList.update((list) =>
              list.map((c) =>
                c.id === (payload.new as Contact).id
                  ? new ContactsModel(payload.new as Contact)
                  : c,
              ),
            );
            break;

          case 'DELETE':
            this.contactsList.update((list) =>
              list.filter((c) => c.id !== (payload.old as Contact).id),
            );
            break;
        }
      })
      .subscribe();
  }
  //#endregion

  //#region USER AUTH -----------------------------------------------------------------------------
  /**
   * Registers a new user and dont! logs them in.
   * @param email User email address
   * @param password User password
   */
  async signup(email: string, password: string): Promise<string | null> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return this.errorMessageHandler(error);
    }

    return 'Check your email to confirm your account';
  }

  /**
   * Logs in a user using email and password.
   * @param email User email address
   * @param password User password
   * @returns Promise<string | null> Returns error message or null if successful
   */
  async login(email: string, password: string): Promise<string | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return this.errorMessageHandler(error);
    }

    this.user.set(data.user);
    return null;
  }
  // /** -> Norman use
  //  * const error = await this.dbService.login(email, password);
  // if (error) {  this.errorMessage = error; }

  /**
   * Logs out the current user and clears all local state.
   */
  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.user.set(null);
  }

  /**
   * Returns true if a user is currently authenticated.
   * >> we can use !!!: @if (dbService.user()) in html
   * @returns boolean True if user is logged in, otherwise false (guest user)
   */
  isLoggedIn(): boolean {
    return this.user() !== null;
  }

  /**
   * Maps Supabase auth errors to user-friendly messages.
   * @: https://supabase.com/docs/guides/auth/debugging/error-codes#auth-error-codes
   */
  private errorMessageHandler(error: any): string {
    if (!error.code) {
      return 'Something went wrong.';
    }

    switch (error.code) {
      case 'email_not_confirmed':
        return 'Please confirm your email address.';

      case 'invalid_login_credentials':
        return 'Email or password is incorrect.';

      case 'over_request_rate_limit':
        return 'Too many attempts. Please try again later.';

      case 'request_timeout':
        return 'Request timed out. Please try again.';

      default:
        return 'Something went wrong. Please try again.';
    }
  }
  //#endregion ------------------------------------------------------------------------------------

  //#region CONTACT DATA -------------------------------------------------------------------------
  async getContacts() {
    const contactModels: ContactsModel[] = [];
    const { data: contacts, error } = (await this.supabase.from('contacts').select('*')) as {
      data: ContactsModel[] | null;
      error: null;
    };

    if (contacts === null) return; // TODO: Errorhandling

    for (let i = 0; i < contacts.length; i++) {
      contactModels.push(new ContactsModel(contacts[i]));
    }
    this.contactsList.set(contactModels);
  }

  // ändern des Detail Signals - Datenbank Sync
  getContactDetails(id: number) {
    this.contactDetailsId.set(id);
  }

  // hinzufügen
  async addContact(contact: ContactsModel): Promise<void> {
    const contact_data = contact.getCleanAddJson();
    const { data: addedContact, error } = await this.supabase.from('contacts').insert(contact_data);

    if (error) {
      return; //TODO: errorHandling
    }
  }

  //bearbeiten
  async updateContact(id: number, contact: ContactsModel): Promise<void> {
    const { error } = await this.supabase
      .from('contacts')
      .update(contact.getCleanAddJson())
      .eq('id', id);

    if (error) {
      return; // TODO: Errorhandling
    }
  }

  // async deleteContact(id: number): Promise<void> {
  //   const { data, error } = await this.supabase.from('contacts').delete().eq('id', id);
  // }
}
