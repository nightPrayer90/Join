import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Supabase } from '../../../../service/supabase';
import { ContactsModel } from '../../../../shared/models/contacts-model';

@Component({
  selector: 'app-contact-dialog',
  imports: [FormsModule],
  templateUrl: './contact-dialog.html',
  styleUrl: './contact-dialog.scss',
})
export class ContactDialog {
  @Input() isOpen: boolean = false;
  @Input() mode: 'add' | 'edit' = 'add';
  @Output() closeDialog = new EventEmitter<void>();
  @Output() contactCreated = new EventEmitter<void>();
  @Output() contactCreatedWithId = new EventEmitter<number>();
  @Output() contactUpdated = new EventEmitter<void>();
  @Output() contactDeleted = new EventEmitter<void>();

  private dbService = inject(Supabase);

  editContactId: number | null = null;
  fullName: string = '';
  email: string = '';
  private originalEmail: string = '';
  private editedContactIsUser: boolean = false;
  phone: string = '';
  avatarColor: string = '#d1d1d1';
  avatarInitials: string = '';
  fullNameError: string = '';
  emailError: string = '';
  phoneError: string = '';
  submitError: string = '';
  isSaving: boolean = false;

  /** Reacts to mode/open input changes by preparing add or edit data. */
  ngOnChanges(changes: SimpleChanges): void {
    const modeChanged = !!changes['mode'];
    const openChanged = !!changes['isOpen'];
    if (!modeChanged && !openChanged) return;
    if (!this.isOpen) return;
    if (this.mode === 'edit') {
      this.applyEditData();
      return;
    }
    this.prepareAddData();
  }

  /** Clears name-related validation errors while the user is typing. */
  onFullNameInput(): void {
    this.fullNameError = '';
    this.submitError = '';
  }

  /** Clears email validation errors while the user is typing, or restores the original email for user contacts. */
  onEmailInput(): void {
    if (this.isUserContact()) {
      this.email = this.originalEmail;
      return;
    }
    this.emailError = '';
    this.submitError = '';
  }

  /** Clears phone validation errors while the user is typing. */
  onPhoneInput(): void {
    this.phoneError = '';
    this.submitError = '';
  }

  /** Validates and submits the dialog data to create or update a contact. */
  async onSubmit(): Promise<void> {
    if (this.isSaving) return;
    this.submitError = '';
    if (!this.validateForm()) return;
    this.isSaving = true;
    try {
      const createdNew = await this.runSubmitForCurrentMode();
      this.finishSubmitSuccess(createdNew);
    } catch {
      this.setSubmitError();
    } finally {
      this.isSaving = false;
    }
  }

  /** Performs the create or update operation depending on the current dialog mode. */
  private async runSubmitForCurrentMode(): Promise<boolean> {
    if (this.mode === 'edit' && this.editContactId !== null) {
      await this.updateExistingContact();
      return false;
    }
    await this.createNewContact();
    return true;
  }

  /** Persists the edited contact and emits the update event. */
  private async updateExistingContact(): Promise<void> {
    await this.dbService.updateContact(this.editContactId!, new ContactsModel({
      id: this.editContactId!,
      full_name: this.fullName.trim(),
      email: this.getEmailForSave(),
      phone: this.phone.trim(),
      avatar_color: this.avatarColor,
    }));
    this.contactUpdated.emit();
  }

  /** Creates a new contact in the database and emits the created event with the new id. */
  private async createNewContact(): Promise<void> {
    const createdId = await this.dbService.addContact(new ContactsModel({
      full_name: this.fullName.trim(),
      email: this.email.trim(),
      phone: this.phone.trim(),
      avatar_color: this.getAvatarColor(),
      isUser: false,
    }));
    if (createdId !== null) {
      this.contactCreatedWithId.emit(createdId);
    }
  }

  /** Resets the form, emits the created event when applicable and closes the dialog. */
  private finishSubmitSuccess(createdNew: boolean): void {
    this.resetForm();
    if (createdNew) this.contactCreated.emit();
    this.closeDialog.emit();
  }

  /** Sets a generic submit error message based on the current dialog mode. */
  private setSubmitError(): void {
    this.submitError = this.mode === 'edit'
      ? 'Contact could not be updated. Please try again.'
      : 'Contact could not be created. Please try again.';
  }

  /** Deletes the currently edited contact after confirming the operation is allowed. */
  async onDelete(): Promise<void> {
    if (!this.canDelete()) return;
    const deleteId = this.editContactId!;
    this.prepareDeleteOptimistic();
    await this.runDelete(deleteId);
  }

  /** Returns true if the contact in the current dialog state can be deleted. */
  private canDelete(): boolean {
    if (this.mode !== 'edit') return false;
    if (this.isSaving) return false;
    if (this.editContactId === null) return false;
    return true;
  }

  /** Optimistically resets the dialog and clears local selection before the delete call. */
  private prepareDeleteOptimistic(): void {
    this.submitError = '';
    this.isSaving = true;
    this.dbService.contactDetailsId.set(null);
    this.resetForm();
    this.closeDialog.emit();
  }

  /** Runs the delete call and emits the deleted event or stores an error message. */
  private async runDelete(deleteId: number): Promise<void> {
    try {
      await this.dbService.deleteContact(deleteId);
      this.contactDeleted.emit();
    } catch {
      this.submitError = 'Contact could not be deleted. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  /** Emits the close event so the parent component can hide the dialog. */
  onClose(): void {
    this.closeDialog.emit();
  }

  /** Returns true if the currently edited contact belongs to the logged-in user. */
  isOwnUserContact(): boolean {
    if (this.mode !== 'edit') return false;
    const userEmail = this.dbService.user()?.email;
    if (!userEmail || !this.originalEmail) return false;
    return ContactsModel.normalizeEmail(userEmail) === ContactsModel.normalizeEmail(this.originalEmail);
  }

  /** Returns true if the contact being edited represents a registered application user. */
  isUserContact(): boolean {
    return this.mode === 'edit' && this.editedContactIsUser;
  }

  /** Runs every individual field validator and returns true only when each one passes. */
  private validateForm(): boolean {
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    const isNameValid = this.validateName();
    const isEmailValid = this.validateEmail();
    const isPhoneValid = this.validatePhone();
    return isNameValid && isEmailValid && isPhoneValid;
  }

  private static readonly NAME_TOKEN_REGEX = /^[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)?$/;
  private static readonly DOTTED_TOKEN_REGEX = /^[A-Za-zÄÖÜäöüß]\.$/;

  /** Validates the full name through several layered rules. */
  private validateName(): boolean {
    const value = this.fullName.trim();
    const tokens = value.split(/\s+/).filter(Boolean);
    if (!this.validateBasicNameRules(value, tokens)) return false;
    if (!this.validateNameTokens(tokens)) return false;
    if (!this.validateDottedAbbreviation(tokens)) return false;
    return true;
  }

  /** Checks the most basic name rules such as non-empty value, digit-free input and minimum word count. */
  private validateBasicNameRules(value: string, tokens: string[]): boolean {
    if (!value) return this.setFullNameError('Please enter first and last name.');
    if (/\d/.test(value)) return this.setFullNameError('Name cannot contain numbers.');
    if (tokens.length < 2) return this.setFullNameError('Please enter first and last name.');
    return true;
  }

  /** Validates every non-abbreviation token against the allowed character set. */
  private validateNameTokens(tokens: string[]): boolean {
    for (const token of tokens) {
      if (token.includes('.')) continue;
      if (!ContactDialog.NAME_TOKEN_REGEX.test(token)) {
        return this.setFullNameError('Name may only contain letters and one hyphen within a name part.');
      }
    }
    return true;
  }

  /** Ensures a dotted token is only used as a single middle-name abbreviation. */
  private validateDottedAbbreviation(tokens: string[]): boolean {
    const dottedTokens = tokens.filter((token) => token.includes('.'));
    if (dottedTokens.length === 0) return true;
    const secondToken = tokens[1] ?? '';
    const errorMsg = 'Use abbreviations only as middle name, e.g. "Norman K. Pfalzer".';
    if (tokens.length < 3) return this.setFullNameError(errorMsg);
    const isValid = dottedTokens.length === 1
      && secondToken === dottedTokens[0]
      && ContactDialog.DOTTED_TOKEN_REGEX.test(secondToken);
    return isValid ? true : this.setFullNameError(errorMsg);
  }

  /** Validates the email format against a strict allowed character pattern. */
  private validateEmail(): boolean {
    const value = this.email.trim();
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!value) return this.setEmailError('Please enter your email.');
    if (!emailRegex.test(value)) return this.setEmailError('Please enter a valid email address without unsupported special characters.');
    return true;
  }

  /** Validates the phone field for allowed characters and minimum digit count. */
  private validatePhone(): boolean {
    const value = this.phone.trim();
    const phoneRegex = /^\+?\d[\d\s-]*$/;
    const digitsOnly = value.replace(/\D/g, '');
    if (!value) return this.setPhoneError('Please enter your phone number.');
    if (!phoneRegex.test(value)) return this.setPhoneError('Phone may contain digits, spaces, "-" and optional "+".');
    if (digitsOnly.length < 7) return this.setPhoneError('Phone number must contain at least 7 digits.');
    return true;
  }

  /** Stores an error message for the name field and returns false. */
  private setFullNameError(message: string): false {
    this.fullNameError = message;
    return false;
  }

  /** Stores an error message for the email field and returns false. */
  private setEmailError(message: string): false {
    this.emailError = message;
    return false;
  }

  /** Stores an error message for the phone field and returns false. */
  private setPhoneError(message: string): false {
    this.phoneError = message;
    return false;
  }

  /** Resets every form field and validation message back to its initial empty state. */
  private resetForm(): void {
    this.editContactId = null;
    this.fullName = '';
    this.email = '';
    this.originalEmail = '';
    this.editedContactIsUser = false;
    this.phone = '';
    this.avatarColor = '#d1d1d1';
    this.avatarInitials = '';
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    this.submitError = '';
  }

  /** Clears the form to prepare a new empty contact for the add mode. */
  private prepareAddData(): void {
    this.editContactId = null;
    this.fullName = '';
    this.email = '';
    this.originalEmail = '';
    this.editedContactIsUser = false;
    this.phone = '';
    this.avatarColor = '#d1d1d1';
    this.avatarInitials = '';
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    this.submitError = '';
  }

  /** Loads the currently selected contact into the form so it can be edited. */
  private applyEditData(): void {
    const contact = this.dbService.contactDetails();
    if (!contact) {
      this.submitError = 'No contact selected for editing.';
      return;
    }
    this.hydrateContactFields(contact);
    this.hydrateContactErrors();
  }

  /** Copies the contact's values into the local form fields. */
  private hydrateContactFields(contact: ContactsModel): void {
    this.editContactId = contact.id;
    this.fullName = contact.full_name;
    this.email = contact.email;
    this.originalEmail = contact.email;
    this.editedContactIsUser = contact.isUser;
    this.phone = contact.phone;
    this.avatarColor = contact.avatar_color || '#d1d1d1';
    this.avatarInitials = contact.getInitials();
  }

  /** Clears all validation and submit error messages when entering edit mode. */
  private hydrateContactErrors(): void {
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    this.submitError = '';
  }

  /** Picks a random avatar color from the predefined palette. */
  private getAvatarColor(): string {
    const colors = ['#FF7A00', '#9327FF', '#6E52FF', '#FC71FF', '#FFBB2B', '#1FD7C1', '#3BA9E0'];
    const index = Math.floor(Math.random() * colors.length);
    return colors[index];
  }

  /** Returns the email value that should be persisted, preserving the original for user contacts. */
  private getEmailForSave(): string {
    return this.isUserContact() ? this.originalEmail : this.email.trim();
  }
}
