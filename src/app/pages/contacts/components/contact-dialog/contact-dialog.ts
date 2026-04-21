import { Component, inject } from '@angular/core';
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
  private dbService = inject(Supabase);

  fullName: string = '';
  email: string = '';
  phone: string = '';
  fullNameError: string = '';
  emailError: string = '';
  phoneError: string = '';
  submitError: string = '';
  isSaving: boolean = false;

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
    const contact = new ContactsModel({
      full_name: this.fullName.trim(),
      email: this.email.trim(),
      phone: this.phone.trim(),
      avatar_color: this.getAvatarColor(),
      isUser: false,
    });

    try {
      await this.dbService.addContact(contact);
      this.resetForm();
    } catch {
      this.submitError = 'Contact could not be created. Please try again.';
    } finally {
      this.isSaving = false;
    }
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
    const hasFirstAndLast = value.split(/\s+/).filter(Boolean).length >= 2;
    if (!value) return this.setFullNameError('Please enter first and last name.');
    if (hasNumber) return this.setFullNameError('Name cannot contain numbers.');
    if (!hasFirstAndLast) return this.setFullNameError('Please enter first and last name.');
    return true;
  }

  private validateEmail(): boolean {
    const value = this.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return this.setEmailError('Please enter your email.');
    if (!emailRegex.test(value)) return this.setEmailError('Please enter a valid email address.');
    return true;
  }

  private validatePhone(): boolean {
    const value = this.phone.trim();
    const phoneRegex = /^\+?\d[\d\s-]*$/;
    if (!value) return this.setPhoneError('Please enter your phone number.');
    if (!phoneRegex.test(value)) return this.setPhoneError('Phone may contain digits, spaces, "-" and optional "+".');
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
    this.fullName = '';
    this.email = '';
    this.phone = '';
    this.fullNameError = '';
    this.emailError = '';
    this.phoneError = '';
    this.submitError = '';
  }

  private getAvatarColor(): string {
    const colors = ['#FF7A00', '#9327FF', '#6E52FF', '#FC71FF', '#FFBB2B', '#1FD7C1', '#3BA9E0', '#FF4646'];
    const index = Math.floor(Math.random() * colors.length);
    return colors[index];
  }
}
