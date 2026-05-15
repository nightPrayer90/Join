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
  phone: string = '';
  avatarColor: string = '#d1d1d1';
  avatarInitials: string = '';
  fullNameError: string = '';
  emailError: string = '';
  phoneError: string = '';
  submitError: string = '';
  isSaving: boolean = false;

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

  onFullNameInput(): void {
    this.fullNameError = '';
    this.submitError = '';
  }

  onEmailInput(): void {
    this.emailError = '';
    this.submitError = '';
  }

  onPhoneInput(): void {
    this.phoneError = '';
    this.submitError = '';
  }

  async onSubmit(): Promise<void> {
    if (this.isSaving) return;
    this.submitError = '';
    if (!this.validateForm()) return;

    this.isSaving = true;
    let createdNewContact = false;
    try {
      if (this.mode === 'edit' && this.editContactId !== null) {
        await this.dbService.updateContact(this.editContactId, new ContactsModel({
          id: this.editContactId,
          full_name: this.fullName.trim(),
          email: this.email.trim(),
          phone: this.phone.trim(),
          avatar_color: this.avatarColor,
        }));
        this.contactUpdated.emit();
      } else {
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
        createdNewContact = true;
      }
      this.resetForm();
      if (createdNewContact) {
        this.contactCreated.emit();
      }
      this.closeDialog.emit();
    } catch {
      this.submitError = this.mode === 'edit'
        ? 'Contact could not be updated. Please try again.'
        : 'Contact could not be created. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  async onDelete(): Promise<void> {
    if (this.mode !== 'edit') return;
    if (this.isSaving) return;
    if (this.editContactId === null) return;
    const deleteId = this.editContactId;
    this.submitError = '';
    this.isSaving = true;
    this.dbService.contactDetailsId.set(null);
    this.resetForm();
    this.closeDialog.emit();
    try {
      await this.dbService.deleteContact(deleteId);
      this.contactDeleted.emit();
    } catch {
      this.submitError = 'Contact could not be deleted. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  onClose(): void {
    this.closeDialog.emit();
  }

  private validateForm(): boolean {
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    const isNameValid = this.validateName();
    const isEmailValid = this.validateEmail();
    const isPhoneValid = this.validatePhone();
    return isNameValid && isEmailValid && isPhoneValid;
  }

  private validateName(): boolean {
    const value = this.fullName.trim();
    const hasNumber = /\d/.test(value);
    const tokens = value.split(/\s+/).filter(Boolean);
    const hasFirstAndLast = tokens.length >= 2;
    const nameTokenRegex = /^[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)?$/;
    const dottedTokenRegex = /^[A-Za-zÄÖÜäöüß]\.$/;
    const dottedTokens = tokens.filter((token) => token.includes('.'));
    const secondToken = tokens[1] ?? '';

    if (!value) return this.setFullNameError('Please enter first and last name.');
    if (hasNumber) return this.setFullNameError('Name cannot contain numbers.');
    if (!hasFirstAndLast) return this.setFullNameError('Please enter first and last name.');

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.includes('.')) {
        continue;
      }

      if (!nameTokenRegex.test(token)) {
        return this.setFullNameError('Name may only contain letters and one hyphen within a name part.');
      }
    }

    if (dottedTokens.length > 0) {
      if (tokens.length < 3) {
        return this.setFullNameError('Use abbreviations only as middle name, e.g. "Norman K. Pfalzer".');
      }

      if (dottedTokens.length !== 1 || secondToken !== dottedTokens[0] || !dottedTokenRegex.test(secondToken)) {
        return this.setFullNameError('Use abbreviations only as middle name, e.g. "Norman K. Pfalzer".');
      }
    }

    return true;
  }

  private validateEmail(): boolean {
    const value = this.email.trim();
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!value) return this.setEmailError('Please enter your email.');
    if (!emailRegex.test(value)) return this.setEmailError('Please enter a valid email address without unsupported special characters.');
    return true;
  }

  private validatePhone(): boolean {
    const value = this.phone.trim();
    const phoneRegex = /^\+?\d[\d\s-]*$/;
    const digitsOnly = value.replace(/\D/g, '');
    if (!value) return this.setPhoneError('Please enter your phone number.');
    if (!phoneRegex.test(value)) return this.setPhoneError('Phone may contain digits, spaces, "-" and optional "+".');
    if (digitsOnly.length < 7) return this.setPhoneError('Phone number must contain at least 7 digits.');
    return true;
  }

  private setFullNameError(message: string): false {
    this.fullNameError = message;
    return false;
  }

  private setEmailError(message: string): false {
    this.emailError = message;
    return false;
  }

  private setPhoneError(message: string): false {
    this.phoneError = message;
    return false;
  }

  private resetForm(): void {
    this.editContactId = null;
    this.fullName = '';
    this.email = '';
    this.phone = '';
    this.avatarColor = '#d1d1d1';
    this.avatarInitials = '';
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    this.submitError = '';
  }

  private prepareAddData(): void {
    this.editContactId = null;
    this.fullName = '';
    this.email = '';
    this.phone = '';
    this.avatarColor = '#d1d1d1';
    this.avatarInitials = '';
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    this.submitError = '';
  }

  private applyEditData(): void {
    const contact = this.dbService.contactDetails();
    if (!contact) {
      this.submitError = 'No contact selected for editing.';
      return;
    }
    this.editContactId = contact.id;
    this.fullName = contact.full_name;
    this.email = contact.email;
    this.phone = contact.phone;
    this.avatarColor = contact.avatar_color || '#d1d1d1';
    this.avatarInitials = contact.getInitials();
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    this.submitError = '';
  }

  private getAvatarColor(): string {
    const colors = ['#FF7A00', '#9327FF', '#6E52FF', '#FC71FF', '#FFBB2B', '#1FD7C1', '#3BA9E0'];
    const index = Math.floor(Math.random() * colors.length);
    return colors[index];
  }
}
