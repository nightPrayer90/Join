import { Injectable, signal } from '@angular/core';
import { createClient, User } from '@supabase/supabase-js';

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

  // Signals
  user = signal<User | null>(null);
  contacts = signal<
    {
      id: number;
      created_at: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      avatar_color: string;
    }[]
  >([]);

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

    // TODO: info at login form
    console.log('Check your email to confirm your account');
    return null;
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
    this.contacts.set([]);
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
  //#endregion

  //#region USER DATA -----------------------------------------------------------------------------
  /**
   * Returns true if a user is currently authenticated.
   * @returns boolean True if user is logged in, otherwise false (guest user)
   */
  isLoggedIn(): boolean {
    return this.user() !== null;
  }

  /**
   * Loads the current authenticated user from Supabase.
   */
  async loadUserData(): Promise<void> {
    const { data, error } = await this.supabase.auth.getUser();

    if (error) {
      // TODO: Error handling
      return;
    }

    this.user.set(data.user);
  }

  //#endregion ------------------------------------------------------------------------------------

  //#region CONTACT DATA -------------------------------------------------------------------------
  async getContact() {
    let { data: contacts, error } = await this.supabase.from('contacts').select('*');
    if (!contacts) return;
    this.contacts.set(contacts);
    console.log(contacts);
  }
}
