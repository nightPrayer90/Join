import { Injectable, signal, computed } from '@angular/core';
import { createClient, RealtimeChannel, Session, User } from '@supabase/supabase-js';
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

  //#region SIGNALS -------------------------------------------------------------------------------

  // * Holds the currently authenticated user from the database.
  user = signal<User | null>(null);

  //   * Reactive list of all contacts loaded from the "contacts" database table.
  contactsList = signal<ContactsModel[]>([]);

  //   * Stores the id of the contact used to control the detail view selection.
  contactDetailsId = signal<number | null>(null);

  /**
   * Computed signal that returns the selected contact based on contactDetailsId.
   * Resolves the contact from contactsList or null if not found.
   */
  contactDetails = computed<ContactsModel | null>(() => {
    const id = this.contactDetailsId();
    if (id === null) return null;

    const list = this.contactsList();
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  });

  tasksList = signal<TasksModel[]>([]);

  // Stores the id of the task used to control the detail view selection.
  taskDetailsId = signal<number | null>(null);

  /**
   * Computed signal that returns the selected task based on taskDetailsId.
   * Resolves the task from tasksList or null if not found.
   */
  taskDetails = computed<TasksModel | null>(() => {
    const id = this.taskDetailsId();
    if (id === null) return null;

    const list = this.tasksList();
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  });
  //#endregion

  /**
   * Important:
   * - The constructor runs only ONCE during app lifetime
   * - It is triggered when the service is injected for the first time
   */
  constructor() {
    this.initAuthListener();
    this.initAuthListener();
    this.subscribeInsert();
    this.subscribeUpdate();
    this.subscribeDelete();
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
      if (session?.user) {
        this.initUserIsLoggedIn(session);
      } else {
        this.initUserIsGuest();
      }
    });
  }

  /**
   * Handles initialization - user state.
   */
  private initUserIsLoggedIn(session: Session): void {
    this.user.set(session.user);
    this.getContacts();
    this.getTasks;
  }

  /**
   * Handles initialization - guest state.
   */
  private initUserIsGuest(): void {
    this.user.set(null);
    this.getContacts();
    this.getTasks();
  }

  /**
   * Subscribes to UPDATE events - Updates the local contacts list by replacing the modified contact.
   */
  private subscribeInsert() {
    this.channelInsert = this.supabase
      .channel('contacts-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contacts' },
        (payload) => {
          this.contactsList.update((list) => [...list, new ContactsModel(payload.new as Contact)]);
        },
      )
      .subscribe();
  }

  /**
   * Subscribes to DELETE events - Removes the deleted contact from the local contacts list.
   */
  private subscribeUpdate() {
    this.channelUpdate = this.supabase
      .channel('contacts-update')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts' },
        (payload) => {
          this.contactsList.update((list) => {
            const updated = payload.new as Contact;
            const result: ContactsModel[] = [];
            for (let i = 0; i < list.length; i++) {
              if (list[i].id === updated.id) {
                result.push(new ContactsModel(updated));
              } else {
                result.push(list[i]);
              }
            }
            return result;
          });
        },
      )
      .subscribe();
  }

  /**
   * Subscribes to DELETE events - Removes the deleted contact from the local contacts list using its id.
   */
  private subscribeDelete() {
    this.channelDelete = this.supabase
      .channel('contacts-delete')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'contacts' },
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
  private subscribeTaskInsert() {
    this.channelInsert = this.supabase
      .channel('tasks-insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        this.tasksList.update((list) => [...list, new TasksModel(payload.new as Tasks)]);
      })
      .subscribe();
  }

  /**
   * Subscribes to INSERT events - Adds new tasks to the local tasks list.
   */
  private subscribeTaskUpdate() {
    this.channelUpdate = this.supabase
      .channel('tasks-update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const updated = payload.new as Tasks;

        this.tasksList.update((list) =>
          list.map((task) => (task.id === updated.id ? new TasksModel(updated) : task)),
        );
      })
      .subscribe();
  }

  /**
   * Subscribes to DELETE events - Removes the deleted task from the local tasks list.
   */
  private subscribeTaskDelete() {
    this.channelDelete = this.supabase
      .channel('tasks-delete')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        const deleteId = payload.old['id'];

        this.tasksList.update((list) => list.filter((task) => task.id !== deleteId));
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

    if (error) return this.errorMessageHandler(error);
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

    if (error) return this.errorMessageHandler(error);
    this.user.set(data.user);
    return null;
  }

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
    if (!error.code) return 'Something went wrong.';
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
  /**
   * Fetches all contacts from the database and updates the local contacts list.
   */
  async getContacts() {
    const contactModels: ContactsModel[] = [];
    const { data: contacts, error } = (await this.supabase.from('contacts').select('*')) as {
      data: ContactsModel[] | null;
      error: null;
    };

    if (error || contacts === null) {
      console.log('Contacts could not be loaded!');
      return; // TODO: Errorhandling
    }
    for (let i = 0; i < contacts.length; i++) {
      contactModels.push(new ContactsModel(contacts[i]));
    }
    this.contactsList.set(contactModels);
  }

  /**
   * Sets the current contact id for the detail view.
   * Triggers reactive updates based on the selected contact.
   * @param id - The id of the contact to display
   */
  getContactDetails(id: number | null) {
    this.contactDetailsId.set(id);
  }

  /**
   * Inserts a new contact into the database.
   * @param contact - The contact model to be added
   */
  async addContact(contact: ContactsModel): Promise<number | null> {
    const contact_data = contact.getCleanAddJson();
    const { data, error } = await this.supabase
      .from('contacts')
      .insert(contact_data)
      .select('id')
      .single();

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
    const { data, error } = await this.supabase.from('contacts').delete().eq('id', id);

    if (error) console.log('The contact could not be deleted'); //TODO: errorHandling
  }
  //#endregion
  //#region TASKS DATA ----------------------------------------------------------------------------
  async getTasks() {
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

  getTaskDetails(id: number | null) {
    this.taskDetailsId.set(id);
  }

  async addTask(task: TasksModel): Promise<number | null> {
    const task_data = task.getCleanAddJson();

    const { data, error } = await this.supabase
      .from('tasks')
      .insert(task_data)
      .select('id')
      .single();

    if (error || !data) {
      console.log('The task could not be added!'); // TODO: errorHandling
      return null;
    }

    return data.id;
  }

  async updateTask(task: TasksModel): Promise<void> {
    const task_data = task.getCleanUpdateJson();
    const { data, error } = await this.supabase.from('tasks').update(task_data).eq('id', task.id);

    if (error) {
      console.log('The task could not be updated!');
    }
  }

  async deleteTask(id: number): Promise<void> {
    const { data, error } = await this.supabase.from('tasks').delete().eq('id', id);

    if (error) {
      console.log('The task could not be deleted'); // TODO: errorHandling
    }
  }
  //#endregion
}
