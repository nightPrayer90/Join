import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../service/supabase';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  private dbService = inject(Supabase);
  private router = inject(Router);
  private toastTimeoutId: number | null = null;

  fullName = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptedPrivacy = false;
  isLoading = false;
  submitAttempted = false;
  errorMessage = '';
  passwordFocused = false;
  confirmPasswordFocused = false;
  passwordVisible = false;
  confirmPasswordVisible = false;
  showToast = signal(false);

  get isFormComplete(): boolean {
    return !!this.fullName.trim()
      && !!this.email.trim()
      && !!this.password
      && !!this.confirmPassword
      && this.acceptedPrivacy
      && !this.isLoading;
  }

  onInput(): void {
    this.errorMessage = '';
  }

  onPasswordFocus(): void {
    this.passwordFocused = true;
  }

  onPasswordBlur(): void {
    this.passwordFocused = false;
    this.passwordVisible = false;
  }

  onConfirmPasswordFocus(): void {
    this.confirmPasswordFocused = true;
  }

  onConfirmPasswordBlur(): void {
    this.confirmPasswordFocused = false;
    this.confirmPasswordVisible = false;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  async onSubmit(): Promise<void> {
    this.submitAttempted = true;
    if (!this.isFormComplete || !this.isFormValid()) return;
    this.isLoading = true;
    try {
      const error = await this.dbService.signup(this.fullName.trim(), this.email.trim(), this.password);
      if (error) {
        this.errorMessage = error;
        return;
      }
      this.openToast();
    } catch {
      this.errorMessage = 'Signup failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  goBack(): void {
    this.router.navigateByUrl('/login');
  }

  nameError(): string {
    if (!this.submitAttempted) return '';
    return this.validateName();
  }

  emailError(): string {
    if (!this.submitAttempted) return '';
    if (!this.email.trim()) return 'Please enter your email.';
    return this.isEmailValid() ? '' : 'Please enter a valid email address.';
  }

  passwordError(): string {
    if (!this.submitAttempted) return '';
    if (!this.password) return 'Please enter your password.';
    return this.password.length >= 6 ? '' : 'Password must be at least 6 characters.';
  }

  confirmPasswordError(): string {
    if (!this.submitAttempted) return '';
    if (!this.confirmPassword) return 'Please confirm your password.';
    return this.password === this.confirmPassword ? '' : 'Passwords do not match.';
  }

  privacyError(): string {
    return this.submitAttempted && !this.acceptedPrivacy ? 'Please accept the privacy policy.' : '';
  }

  private isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  private isFormValid(): boolean {
    return this.nameError() === ''
      && this.isEmailValid()
      && this.password.length >= 6
      && this.password === this.confirmPassword;
  }

  private validateName(): string {
    const value = this.fullName.trim();
    const tokens = value.split(/\s+/).filter(Boolean);
    const tokenError = this.nameTokenError(tokens);
    if (!value || tokens.length < 2) return 'Please enter first and last name.';
    if (/\d/.test(value)) return 'Name cannot contain numbers.';
    if (tokenError) return tokenError;
    return this.middleAbbreviationError(tokens);
  }

  private nameTokenError(tokens: string[]): string {
    const invalidToken = tokens.some(token => !token.includes('.') && !this.isNameTokenValid(token));
    return invalidToken ? 'Name may only contain letters and one hyphen within a name part.' : '';
  }

  private middleAbbreviationError(tokens: string[]): string {
    const dottedTokens = tokens.filter((token) => token.includes('.'));
    if (dottedTokens.length === 0) return '';
    return this.isMiddleAbbreviationValid(tokens, dottedTokens)
      ? ''
      : 'Use abbreviations only as middle name, e.g. "Norman K. Pfalzer".';
  }

  private isNameTokenValid(token: string): boolean {
    return /^[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)?$/.test(token);
  }

  private isMiddleAbbreviationValid(tokens: string[], dottedTokens: string[]): boolean {
    const dottedTokenRegex = /^[A-Za-zÄÖÜäöüß]\.$/;
    const secondToken = tokens[1] ?? '';
    return tokens.length >= 3
      && dottedTokens.length === 1
      && secondToken === dottedTokens[0]
      && dottedTokenRegex.test(secondToken);
  }

  private openToast(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
    this.showToast.set(true);
    this.toastTimeoutId = window.setTimeout(() => {
      this.showToast.set(false);
      this.router.navigateByUrl('/summary');
    }, 1800);
  }
}
