/**
 * Supabase Service (Singleton)
 * (providedIn: 'root')
 */

import { Injectable, signal } from '@angular/core';
import { createClient, Session, User } from '@supabase/supabase-js';
import { Contact, ContactInsert } from '../shared/interface/contact-interface';

// TODO:
// -> parameter -> welcher tabelle wollen wir laden wir bauchen auf jeden fall wenigstens 2 listen -> contacts und member,
// benötigte funktionen:
// -> laden aller einträge
// -> laden eines bestimmten eintrags ->getContact
// -> anlegen eines neuen eintrages -> setContact
// -> updaten eines bestimmten eintrages ->Update contact -> wird alles beschrieben im video 09 weitere CRUD Operationen
// -> löschen eines bestimmten eintrages

// -> subscripe

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  supabaseUrl: string = 'https://guvsrmtryoljhhdpanat.supabase.co';
  supabaseKey: string = 'sb_publishable_pqmeYWYGduxCvtNhzM5HoA_oP6YdAqj';
  supabase = createClient(this.supabaseUrl, this.supabaseKey);

  user = signal<User | null>(null);
  contacts = signal<Contact[]>([]);

  /**
   * Important:
   * - The constructor runs only ONCE during app lifetime
   * - It is triggered when the service is injected for the first time
   *
   * Use this for:
   * - Setting up auth state listeners
   * - Initial data loading
   * - Realtime subscriptions
   */
  constructor() {
    this.initAuthListener();
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
  initUserIsLoggedIn(session: Session): void {
    this.user.set(session.user);
    this.getContacts();
  }

  /**
   * Handles initialization - guest state.
   *
   * Clears the current user and resets all user-related data.
   * This is triggered by the global auth state listener.
   */
  initUserIsGuest(): void {
    this.user.set(null);
    this.getContacts();
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
    const { data: contacts, error } = (await this.supabase.from('contacts').select('*')) as {
      data: Contact[] | null;
      error: null;
    };

    if (contacts === null) return; // TODO: Errorhandling

    this.contacts.set(contacts);
  }

  getContactFromContacts(id: number): Contact | null {
    const contacts: Contact[] = this.contacts();

    for (let i: number = 0; i < contacts.length; i++) {
      if (contacts[i].id === id) {
        return contacts[i];
      }
    }
    return null;
  }

  async getContactFromDB(id: number): Promise<Contact | null> {
    const { data: contact, error } = (await this.supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single()) as {
      data: Contact | null;
      error: null;
    };

    if (contact === null) return null; // TODO: ErrorHandling

    return contact as Contact;
  }

  // hinzufügen
  async setContact(contactInsert: ContactInsert): Promise<void> {
    const { data: contactInsertDB, error } = (await this.supabase
      .from('contacts')
      .insert(contactInsert)
      .select()
      .single()) as {
      data: Contact | null;
      error: null;
    };

    if (contactInsertDB === null) {
      return; // TODO: ErrorHandling
    }

    const tmpContacsCopy = this.contacts().slice();
    tmpContacsCopy.push(contactInsertDB);
    this.contacts.set(tmpContacsCopy);
  }

  // bearbeiten
  async updateContact(id: number, contactInsert: ContactInsert): Promise<void> {
    const { data: updatedContact, error } = (await this.supabase
      .from('contacts')
      .update(contactInsert)
      .eq('id', id)
      .select()
      .single()) as { data: Contact | null; error: any;};

    if (updatedContact === null) {
      return; // TODO: ErrorHandling
    }

    const tmpContacsCopy = this.contacts().slice();

    for (let i = 0; i < tmpContacsCopy.length; i++) {
      if (tmpContacsCopy[i].id === id) {
        tmpContacsCopy[i] = updatedContact;
        break;
      }
    }

    this.contacts.set(tmpContacsCopy);
  }

  getInitials(contact: Contact): string {
    const parts = contact.full_name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return `${first}${second || first}`.toUpperCase();
  }
}
