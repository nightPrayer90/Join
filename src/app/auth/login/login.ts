import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../service/supabase';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly splashDurationMs = 850;
  private readonly postAnimationWaitMs = 1000;
  private dbService = inject(Supabase);
  private router = inject(Router);
  private changeDetector = inject(ChangeDetectorRef);
  private toastTimeoutId: number | null = null;
  private resetTimeoutId: number | null = null;

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  emailError: string = '';
  passwordError: string = '';
  loginError: boolean = false;
  isLoading: boolean = false;
  passwordFocused = false;
  passwordVisible = false;
  showSplash = signal(true);
  showToast = signal(false);

  /** Schedules the splash screen to hide after the animation has finished. */
  constructor() {
    window.setTimeout(() => {
      this.showSplash.set(false);
    }, this.splashDurationMs + this.postAnimationWaitMs);
  }

  /** Resets validation state while the user is typing into the email field. */
  onEmailInput(): void {
    this.clearResetTimeout();
    this.emailError = '';
    this.errorMessage = '';
    this.loginError = false;
  }

  /** Resets validation state while the user is typing into the password field. */
  onPasswordInput(): void {
    this.clearResetTimeout();
    this.passwordError = '';
    this.errorMessage = '';
    this.loginError = false;
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

  /** Toggles plain-text visibility of the password input. */
  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  /** Validates the email field and sets an error message when invalid. */
  private validateEmail(): boolean {
    const value = this.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return this.setEmailError('Please enter your email.');
    if (!emailRegex.test(value)) return this.setEmailError('Please enter a valid email address.');
    return true;
  }

  /** Validates the password field and sets an error message when invalid. */
  private validatePassword(): boolean {
    const value = this.password.trim();
    if (!value) return this.setPasswordError('Please enter your password.');
    if (value.length < 6) return this.setPasswordError('Password must be at least 6 characters.');
    return true;
  }

  /** Runs all field validators and returns true only if every check passes. */
  private validateForm(): boolean {
    this.emailError = '';
    this.passwordError = '';
    const isEmailValid = this.validateEmail();
    const isPasswordValid = this.validatePassword();
    return isEmailValid && isPasswordValid;
  }

  /** Stores an error message for the email field and returns false. */
  private setEmailError(message: string): false {
    this.emailError = message;
    return false;
  }

  /** Stores an error message for the password field and returns false. */
  private setPasswordError(message: string): false {
    this.passwordError = message;
    return false;
  }

  /** Handles the login submit, validates input and authenticates the user. */
  async onSubmit(): Promise<void> {
    if (this.isLoading) return;
    this.errorMessage = '';
    if (!this.validateForm()) return;

    this.isLoading = true;
    try {
      const error = await this.dbService.login(this.email.trim(), this.password);
      if (error) {
        this.showLoginError(error);
        return;
      }
      this.openToast();
    } catch {
      this.errorMessage = 'Login failed. Please try again.';
    } finally {
      this.isLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  /** Signs the user in as an anonymous guest and shows the success toast. */
  async onGuestLogin(): Promise<void> {
    if (this.isLoading) return;
    this.errorMessage = '';
    this.isLoading = true;
    try {
      const error = await this.dbService.loginAsGuest();
      if (error) {
        this.errorMessage = error;
        return;
      }
      this.openToast();
    } catch {
      this.errorMessage = 'Guest login failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  /** Returns true if a user is currently authenticated. */
  isLoggedIn(): boolean {
    return this.dbService.isLoggedIn();
  }

  /** Displays the success toast and navigates to the summary after a short delay. */
  private openToast(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
    this.showToast.set(true);
    this.toastTimeoutId = window.setTimeout(() => {
      this.showToast.set(false);
      this.router.navigate(['/summary', true]);
    }, 1200);
  }

  /** Shows an error message and schedules the form to reset after a delay. */
  private showLoginError(error: string): void {
    this.loginError = true;
    this.errorMessage = error;
    this.resetTimeoutId = window.setTimeout(() => this.resetLoginForm(), 2400);
    this.changeDetector.detectChanges();
  }

  /** Clears the login form fields and removes any visible error state. */
  private resetLoginForm(): void {
    this.email = '';
    this.password = '';
    this.passwordVisible = false;
    this.loginError = false;
    this.errorMessage = '';
    this.changeDetector.detectChanges();
  }

  /** Cancels the pending login-form reset timeout if one is active. */
  private clearResetTimeout(): void {
    if (this.resetTimeoutId === null) return;
    window.clearTimeout(this.resetTimeoutId);
    this.resetTimeoutId = null;
  }

}
