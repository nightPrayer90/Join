import { Injectable, signal, computed } from '@angular/core';
import { createClient, RealtimeChannel, User } from '@supabase/supabase-js';
import { Contact } from '../shared/interface/contact-interface';
import { ContactsModel } from '../shared/models/contacts-model';
import { TasksModel } from '../shared/models/tasks-model';
import { Tasks } from '../shared/interface/tasks-interface';

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  supabaseUrl: string = 'https://guvsrmtryoljhhdpanat.supabase.co';
  supabaseKey: string = 'sb_publishable_pqmeYWYGduxCvtNhzM5HoA_oP6YdAqj';
  supabase = createClient(this.supabaseUrl, this.supabaseKey);
  channelInsert: RealtimeChannel | undefined;
  channelUpdate: RealtimeChannel | undefined;
  channelDelete: RealtimeChannel | undefined;
  channelTaskInsert: RealtimeChannel | undefined;
  channelTaskUpdate: RealtimeChannel | undefined;
  channelTaskDelete: RealtimeChannel | undefined;

  user = signal<User | null>(null);   // Holds the currently authenticated user from the database.

  contactsList = signal<ContactsModel[]>([]);               // Reactive list of all contacts loaded from the "contacts" database table.
  contactDetailsId = signal<number | null>(null);           // Stores the id of the contact used to control the detail view selection.
  contactDetails = computed<ContactsModel | null>(() => {   // Computed signal that returns the selected contact based on contactDetailsId. -  null if not found
    const id = this.contactDetailsId();
    if (id === null) return null;

    const list = this.contactsList();
    return list.find(t => t.id === id) ?? null;
  });

  tasksList = signal<TasksModel[]>([]);                 // Reactive list of all contacts loaded from the "tasks" database table.
  taskDetailsId = signal<number | null>(null);          // Stores the id of the task used to control the detail view selection.
  taskDetails = computed<TasksModel | null>(() => {     // Computed signal that returns the selected contact based on contactDetailsId. -  null if not found
    const id = this.taskDetailsId();
    if (id === null) return null;

    const list = this.tasksList();
    return list.find(t => t.id === id) ?? null;
  });

  constructor() {
    this.initAuthListener();
    this.subscribeContacsInsert();
    this.subscribeContacsUpdate();
    this.subscribeContacsDelete();
    this.subscribeTaskInsert();
    this.subscribeTaskUpdate();
    this.subscribeTaskDelete();
  }

  ngOnDestroy() {
    if (this.channelInsert) this.supabase.removeChannel(this.channelInsert);
    if (this.channelUpdate) this.supabase.removeChannel(this.channelUpdate);
    if (this.channelDelete) this.supabase.removeChannel(this.channelDelete);
    if (this.channelTaskInsert) this.supabase.removeChannel(this.channelTaskInsert);
    if (this.channelTaskUpdate) this.supabase.removeChannel(this.channelTaskUpdate);
    if (this.channelTaskDelete) this.supabase.removeChannel(this.channelTaskDelete);
  }

  //#region SERVICE INIT -------------------------------------------------------------------------
  /**
   * Initializes auth state listener.
   * @see: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
   */
  private initAuthListener(): void {
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        this.clearAuthState();
        return;
      }
      this.user.set(session.user);
      if (event !== 'SIGNED_IN') {
        window.setTimeout(() => this.loadAppData(), 0);
      }
    });
  }

  /**
   * Handles initialization - task and contact data.
   */
  private loadAppData(): void {
    this.getContacts();
    this.getTasks();
  }

  /**
   * Subscribes to INSERT events - Adds new contacts to the local contacts list.
   */
  private subscribeContacsInsert(): void {
    this.channelInsert = this.supabase
      .channel('contacts-insert')
      .on( 'postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' },
        (payload) => { this.addContactToState(new ContactsModel(payload.new as Contact)); },
      )
      .subscribe();
  }

  /**
   * Subscribes to DELETE events - Removes the deleted contact from the local contacts list.
   */
  private subscribeContacsUpdate(): void {
    this.channelUpdate = this.supabase
      .channel('contacts-update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts' }, 
        (payload) => { 
          this.contactsList.update((list) => {
          const updated = payload.new as Contact;
          return list.map((contact) => 
          contact.id === updated.id ? new ContactsModel(updated) : contact);
        });
      },
    )
    .subscribe();
}

  /**
   * Subscribes to DELETE events - Removes the deleted contact from the local contacts list using its id.
   */
  private subscribeContacsDelete():void {
    this.channelDelete = this.supabase
      .channel('contacts-delete')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'contacts' },
        (payload) => { 
          const deleteId = payload.old['id'];
          this.contactsList.update((list) => list.filter((contact) => contact.id !== deleteId));
        },
      )
      .subscribe();
  }

  /**
   * Subscribes to INSERT events - Adds new tasks to the local tasks list.
   */
  private subscribeTaskInsert(): void {
    this.channelInsert = this.supabase
      .channel('tasks-insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, 
        (payload) => { this.tasksList.update((list) => [...list, new TasksModel(payload.new as Tasks)]); }
      )
      .subscribe();
  }

  /**
   * Subscribes to INSERT events - Adds new tasks to the local tasks list.
   */
  private subscribeTaskUpdate(): void {
    this.channelUpdate = this.supabase
      .channel('tasks-update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, 
        (payload) => {
          this.tasksList.update((list) => {
          const updated = payload.new as Tasks;
          return list.map((task) => 
          task.id === updated.id ? new TasksModel(updated) : task);
        });
      },
    )
    .subscribe();
  }

  /**
   * Subscribes to DELETE events - Removes the deleted task from the local tasks list.
   */
  private subscribeTaskDelete(): void {
    this.channelDelete = this.supabase
      .channel('tasks-delete')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, 
        (payload) => {
          const deleteId = payload.old['id'];
          this.tasksList.update((list) => list.filter((task) => task.id !== deleteId));
      })
      .subscribe();
  }
  //#endregion

  //#region USER AUTH -----------------------------------------------------------------------------
  /**
   * Registers a new user and creates the matching user contact.
   * @param name User full name
   * @param email User email address
   * @param password User password
   */
  async signup(name: string, email: string, password: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email, password, options: { data: { full_name: name } },
      });
      if (error) return this.errorMessageHandler(error);
      if (data.user?.identities?.length === 0) return 'This email is already registered.';
      if (!data.session) return 'Please confirm your email address.';
      this.user.set(data.user);
      await this.ensureUserContact(name, email);
      this.loadAppData();
      return null;
    } catch (error) {
      return this.errorMessageHandler(error);
    }
  }

  /**
   * Logs in a user using email and password.
   * @param email User email address
   * @param password User password
   * @returns Promise<string | null> Returns error message or null if successful
   */
  async login(email: string, password: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) return this.errorMessageHandler(error);
      this.user.set(data.user);
      this.loadAppData();
      return null;
    } catch (error) {
      return this.errorMessageHandler(error);
    }
  }

  /**
   * Logs in with a real Supabase anonymous guest user.
   * @returns Promise<string | null> Error message or null if successful
   */
  async loginAsGuest(): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.auth.signInAnonymously();
      if (error) return this.errorMessageHandler(error);
      this.user.set(data.user);
      this.loadAppData();
      return null;
    } catch (error) {
      return this.errorMessageHandler(error);
    }
  }

  /**
   * Logs out the current user and clears all local state.
   */
  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.clearAuthState();
  }

  /**
   * Clears the current auth-related local state.
   */
  private clearAuthState(): void {
    this.user.set(null);
    this.contactsList.set([]);
    this.tasksList.set([]);
  }

  /**
   * Restores an existing Supabase session for route guards and page reloads.
   * @returns True when a logged-in or anonymous Supabase user exists
   */
  async hasActiveSession(): Promise<boolean> {
    try {
      if (this.user()) return true;
      const { data } = await this.supabase.auth.getSession();
      const user = data.session?.user ?? null;
      this.user.set(user);
      if (user) this.loadAppData();
      return user !== null;
    } catch {
      this.clearAuthState();
      return false;
    }
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
    if (!error.code) return 'Something went wrong.';
    switch (error.code) {
      case 'email_not_confirmed':
        return 'Please confirm your email address.';
      case 'invalid_login_credentials':
        return 'Email or password is incorrect.';
      case 'over_request_rate_limit':
        return 'Too many attempts. Please try again later.';
      case 'anonymous_provider_disabled':
        return 'Guest login is not enabled in Supabase.';
      case 'email_exists':
      case 'user_already_exists':
        return 'This email is already registered.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  /**
   * Creates the current user contact if no contact with the same email exists.
   * @param name User full name
   * @param email User email
   */
  private async ensureUserContact(name: string, email: string): Promise<void> {
    await this.getContacts();
    const cleanEmail = this.normalizeEmail(email);
    const exists = this.contactsList().some(contact => contact.getNormalizeEmail() === cleanEmail);
    if (exists) return;
    await this.addContact(new ContactsModel({ full_name: name, email: cleanEmail, phone: '', avatar_color: '#FF4646', isUser: true, }));
  }
  //#endregion ------------------------------------------------------------------------------------
  
  //#region CONTACT DATA -------------------------------------------------------------------------
  /**
   * Fetches all contacts from the database and updates the local contacts list.
   */
  async getContacts(): Promise<void> {
    const contactModels: ContactsModel[] = [];
    const { data, error } = (await this.supabase.from('contacts').select('*')) as {
      data: ContactsModel[] | null;
      error: null;
    };
    if (error || data === null) {
      console.log('Contacts could not be loaded!');
      return; // TODO: Errorhandling
    }
    for (let i = 0; i < data.length; i++) {
      contactModels.push(new ContactsModel(data[i]));
    }
    this.contactsList.set(contactModels);
  }

  /**
   * Adds a contact to local state only if it is not already present.
   * @param contact Contact model from realtime insert
   */
  private addContactToState(contact: ContactsModel): void {
    this.contactsList.update((list) => {
      const email = this.normalizeEmail(contact.email);
      const exists = list.some(item => item.id === contact.id || this.normalizeEmail(item.email) === email);
      return exists ? list : [...list, contact];
    });
  }

  /**
   * Normalizes email values before comparing or saving them.
   * @param email Email value
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Sets the current contact id for the detail view.
   * Triggers reactive updates based on the selected contact.
   * @param id - The id of the contact to display
   */
  getContactDetails(id: number | null): void {
    this.contactDetailsId.set(id);
  }

  /**
   * Inserts a new contact into the database.
   * @param contact - The contact model to be added
   */
  async addContact(contact: ContactsModel): Promise<number | null> {
    const contact_data = contact.getCleanAddJson();
    const { data, error } = await this.supabase.from('contacts').insert(contact_data).select('id').single();

    if (error || !data) {
      console.log('The contact could not be added!'); //TODO: errorHandling
      return null;
    }
    return data.id;
  }

  /**
   * Updates an existing contact in the database.
   * @param id - The id of the contact to update
   * @param contact - The updated contact data
   */
  async updateContact(id: number, contact: ContactsModel): Promise<void> {
    const contact_data = contact.getCleanUpdateJson();
    const { error } = await this.supabase.from('contacts').update(contact_data).eq('id', id);
    if (error) console.log('The contact could not be updated!'); //TODO: errorHandling
  }

  /**
   * Deletes a contact from the database by id.
   * @param id - The id of the contact to delete
   */
  async deleteContact(id: number): Promise<void> {
    const { error } = await this.supabase.from('contacts').delete().eq('id', id);
    if (error) console.log('The contact could not be deleted'); //TODO: errorHandling
  }

  //#endregion ------------------------------------------------------------------------------------

  //#region TASKS DATA ----------------------------------------------------------------------------
  /**
  * Fetches all tasks from the database and updates the local tasks list.
  * Converts raw task data into {@link TasksModel} instances before storing them.
  */
  async getTasks(): Promise<void> {
    const tasksModel: TasksModel[] = [];
    const { data, error } = (await this.supabase.from('tasks').select('*')) as {
      data: Tasks[] | null;
      error: any;
    };
    if (error || data === null) {
      console.log('tasks could not be loaded!');
      return; // TODO: Errorhandling
    }
    for (let i = 0; i < data.length; i++) {
      tasksModel.push(new TasksModel(data[i]));
    }
    this.tasksList.set(tasksModel);
  }

  /**
  * Sets the currently selected task ID for displaying task details.
  * @param {number | null} id - The ID of the task or null to clear selection
  */
  getTaskDetails(id: number | null): void {
    this.taskDetailsId.set(id);
  }

  /**
  * Adds a new task to the database. Sends a cleaned task object and returns the generated task ID.
  * @param {TasksModel} task - The task to be added
  */
  async addTask(task: TasksModel): Promise<number | null> {
    const task_data = task.getCleanAddJson();
    const { data, error } = await this.supabase.from('tasks').insert(task_data).select('id').single();

    if (error || !data) {
      console.log('The task could not be added!', error); // TODO: errorHandling
      return null;
    }
    return data.id;
  }

  /**
  * Updates an existing task in the database.
  * @param {TasksModel} task - The task with updated data
  */
  async updateTask(task: TasksModel): Promise<void> {
    const task_data = task.getCleanUpdateJson();
    const { error } = await this.supabase.from('tasks').update(task_data).eq('id', task.id);

    if (error) console.log('The task could not be updated!'); // TODO: errorHandling
  }

  /**
  * Deletes a task from the database by its ID.
  * @param {number} id - The ID of the task to delete
  */
  async deleteTask(id: number): Promise<void> {
    const { error } = await this.supabase.from('tasks').delete().eq('id', id);

    if (error) console.log('The task could not be deleted'); // TODO: errorHandling
  }
  //#endregion
}
