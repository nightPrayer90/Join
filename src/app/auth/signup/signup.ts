import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
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
  private readonly confirmEmailMessage = 'Please confirm your email address.';
  private readonly signupSuccessMessage = 'You Signed Up successfully';
  private readonly signupConfirmationMessage = 'We sent you an email. Please confirm your email address before logging in.';
  private dbService = inject(Supabase);
  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);
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
  toastMessage = signal(this.signupSuccessMessage);

  /** Returns true when all required fields are filled and the form can be submitted. */
  get isFormComplete(): boolean {
    return !!this.fullName.trim()
      && !!this.email.trim()
      && !!this.password
      && !!this.confirmPassword
      && this.acceptedPrivacy
      && !this.isLoading;
  }

  /** Clears the current error message while the user is editing any field. */
  onInput(): void {
    this.errorMessage = '';
  }

  /** Marks the password field as focused so the visibility toggle becomes available. */
  onPasswordFocus(): void {
    this.passwordFocused = true;
  }

  /** Marks the password field as unfocused and hides the password text. */
  onPasswordBlur(): void {
    this.passwordFocused = false;
    this.passwordVisible = false;
  }

  /** Marks the confirm-password field as focused so the visibility toggle becomes available. */
  onConfirmPasswordFocus(): void {
    this.confirmPasswordFocused = true;
  }

  /** Marks the confirm-password field as unfocused and hides the password text. */
  onConfirmPasswordBlur(): void {
    this.confirmPasswordFocused = false;
    this.confirmPasswordVisible = false;
  }

  /** Toggles plain-text visibility of the password input. */
  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  /** Toggles plain-text visibility of the confirm-password input. */
  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  /** Validates the form and starts the Supabase signup process. */
  async onSubmit(): Promise<void> {
    this.submitAttempted = true;
    if (!this.isFormComplete || !this.isFormValid()) return;
    this.isLoading = true;
    try {
      await this.runSignupAttempt();
    } catch {
      this.errorMessage = 'Signup failed. Please try again.';
    } finally {
      this.finalizeSignupAttempt();
    }
  }

  /** Executes the signup call and routes the result into success or error handling. */
  private async runSignupAttempt(): Promise<void> {
    const error = await this.dbService.signup(this.fullName.trim(), this.email.trim(), this.password);
    if (error) {
      this.handleSignupError(error);
      return;
    }
    this.handleSignupSuccess();
  }

  /** Shows the success toast and navigates to the summary page. */
  private handleSignupSuccess(): void {
    this.openToast(this.signupSuccessMessage, '/summary', 1800);
  }

  /** Resets the loading state and forces change detection after a signup attempt. */
  private finalizeSignupAttempt(): void {
    this.isLoading = false;
    this.changeDetector.detectChanges();
  }

  /** Navigates back to the login screen. */
  goBack(): void {
    this.router.navigateByUrl('/login');
  }

  /** Returns the validation error for the full name field, or an empty string when valid. */
  nameError(): string {
    if (!this.submitAttempted) return '';
    return this.validateName();
  }

  /** Returns the validation error for the email field, or an empty string when valid. */
  emailError(): string {
    if (!this.submitAttempted) return '';
    if (!this.email.trim()) return 'Please enter your email.';
    return this.isEmailValid() ? '' : 'Please enter a valid email address.';
  }

  /** Returns the validation error for the password field, or an empty string when valid. */
  passwordError(): string {
    if (!this.submitAttempted) return '';
    if (!this.password) return 'Please enter your password.';
    return this.password.length >= 6 ? '' : 'Password must be at least 6 characters.';
  }

  /** Returns the validation error for the confirm-password field, or an empty string when valid. */
  confirmPasswordError(): string {
    if (!this.submitAttempted) return '';
    if (!this.confirmPassword) return 'Please confirm your password.';
    return this.password === this.confirmPassword ? '' : 'Passwords do not match.';
  }

  /** Checks whether the email field contains a syntactically valid address. */
  private isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  /** Returns true when every form field passes its validation rules. */
  private isFormValid(): boolean {
    return this.nameError() === ''
      && this.isEmailValid()
      && this.password.length >= 6
      && this.password === this.confirmPassword;
  }

  /** Validates the full name and returns an error message or an empty string. */
  private validateName(): string {
    const value = this.fullName.trim();
    const tokens = value.split(/\s+/).filter(Boolean);
    const tokenError = this.nameTokenError(tokens);
    if (!value || tokens.length < 2) return 'Please enter first and last name.';
    if (/\d/.test(value)) return 'Name cannot contain numbers.';
    if (tokenError) return tokenError;
    return this.middleAbbreviationError(tokens);
  }

  /** Returns an error message when any non-abbreviation name token contains invalid characters. */
  private nameTokenError(tokens: string[]): string {
    const invalidToken = tokens.some(token => !token.includes('.') && !this.isNameTokenValid(token));
    return invalidToken ? 'Name may only contain letters and one hyphen within a name part.' : '';
  }

  /** Returns an error message when a dotted abbreviation is not used as a middle initial. */
  private middleAbbreviationError(tokens: string[]): string {
    const dottedTokens = tokens.filter((token) => token.includes('.'));
    if (dottedTokens.length === 0) return '';
    return this.isMiddleAbbreviationValid(tokens, dottedTokens)
      ? ''
      : 'Use abbreviations only as middle name, e.g. "Norman K. Pfalzer".';
  }

  /** Checks whether a single name token only contains letters and at most one hyphen. */
  private isNameTokenValid(token: string): boolean {
    return /^[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)?$/.test(token);
  }

  /** Checks whether the dotted token is positioned as a valid middle-name abbreviation. */
  private isMiddleAbbreviationValid(tokens: string[], dottedTokens: string[]): boolean {
    const dottedTokenRegex = /^[A-Za-zÄÖÜäöüß]\.$/;
    const secondToken = tokens[1] ?? '';
    return tokens.length >= 3
      && dottedTokens.length === 1
      && secondToken === dottedTokens[0]
      && dottedTokenRegex.test(secondToken);
  }

  /** Handles a failed signup attempt by either showing an inline error or a confirmation toast. */
  private handleSignupError(error: string): void {
    if (error !== this.confirmEmailMessage) {
      this.errorMessage = error;
      this.changeDetector.detectChanges();
      return;
    }
    this.openToast(this.signupConfirmationMessage, '/login', 3200);
  }

  /** Shows a toast message and navigates to the target URL after the given duration. */
  private openToast(message: string, targetUrl: string, duration: number): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
    this.toastMessage.set(message);
    this.showToast.set(true);
    this.changeDetector.detectChanges();
    this.toastTimeoutId = window.setTimeout(() => {
      this.showToast.set(false);
      this.router.navigateByUrl(targetUrl);
      this.changeDetector.detectChanges();
    }, duration);
  }
}
