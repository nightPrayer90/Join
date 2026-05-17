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

  constructor() {
    window.setTimeout(() => {
      this.showSplash.set(false);
    }, this.splashDurationMs + this.postAnimationWaitMs);
  }

  onEmailInput(): void {
    this.clearResetTimeout();
    this.emailError = '';
    this.errorMessage = '';
    this.loginError = false;
  }

  onPasswordInput(): void {
    this.clearResetTimeout();
    this.passwordError = '';
    this.errorMessage = '';
    this.loginError = false;
  }

  onPasswordFocus(): void {
    this.passwordFocused = true;
  }

  onPasswordBlur(): void {
    this.passwordFocused = false;
    this.passwordVisible = false;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  private validateEmail(): boolean {
    const value = this.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return this.setEmailError('Please enter your email.');
    if (!emailRegex.test(value)) return this.setEmailError('Please enter a valid email address.');
    return true;
  }

  private validatePassword(): boolean {
    const value = this.password.trim();
    if (!value) return this.setPasswordError('Please enter your password.');
    if (value.length < 6) return this.setPasswordError('Password must be at least 6 characters.');
    return true;
  }

  private validateForm(): boolean {
    this.emailError = '';
    this.passwordError = '';
    const isEmailValid = this.validateEmail();
    const isPasswordValid = this.validatePassword();
    return isEmailValid && isPasswordValid;
  }

  private setEmailError(message: string): false {
    this.emailError = message;
    return false;
  }

  private setPasswordError(message: string): false {
    this.passwordError = message;
    return false;
  }

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

  isLoggedIn(): boolean {
    return this.dbService.isLoggedIn();
  }

  private openToast(): void {
    if (this.toastTimeoutId !== null) window.clearTimeout(this.toastTimeoutId);
    this.showToast.set(true);
    this.toastTimeoutId = window.setTimeout(() => {
      this.showToast.set(false);
      this.router.navigate(['/summary', true]);
    }, 1200);
  }

  private showLoginError(error: string): void {
    this.loginError = true;
    this.errorMessage = error;
    this.resetTimeoutId = window.setTimeout(() => this.resetLoginForm(), 2400);
    this.changeDetector.detectChanges();
  }

  private resetLoginForm(): void {
    this.email = '';
    this.password = '';
    this.passwordVisible = false;
    this.loginError = false;
    this.errorMessage = '';
    this.changeDetector.detectChanges();
  }

  private clearResetTimeout(): void {
    if (this.resetTimeoutId === null) return;
    window.clearTimeout(this.resetTimeoutId);
    this.resetTimeoutId = null;
  }

}
