import { Component, inject, signal } from '@angular/core';
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

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  emailError: string = '';
  passwordError: string = '';
  isLoading: boolean = false;
  showSplash = signal(true);

  constructor() {
    window.setTimeout(() => {
      this.showSplash.set(false);
    }, this.splashDurationMs + this.postAnimationWaitMs);
  }

  onEmailInput(): void {
    this.emailError = '';
    this.errorMessage = '';
  }

  onPasswordInput(): void {
    this.passwordError = '';
    this.errorMessage = '';
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
    const error = await this.dbService.login(this.email.trim(), this.password);

    this.isLoading = false;
    if (error) {
      this.errorMessage = error;
      return;
    }

    await this.router.navigateByUrl('/summary');
  }

  async onGuestLogin(): Promise<void> {
    await this.router.navigateByUrl('/summary');
  }

  isLoggedIn(): boolean {
    return this.dbService.isLoggedIn();
  }
}
