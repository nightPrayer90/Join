import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Supabase } from '../../service/supabase';
import { Router } from '@angular/router'; 
import { computed } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly dbService = inject(Supabase);
  private readonly router = inject(Router);
  readonly isMenuOpen = signal(false);
  readonly avatarLabel = computed(() => this.getAvatarLabel());

  /** Toggles the user menu dropdown open or closed. */
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update(value => !value);
  }

  /** Closes the user menu dropdown. */
  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  /** Logs out the current user and navigates back to the login screen. */
  async logout(): Promise<void> {
    this.closeMenu();
    await this.dbService.logout();
    await this.router.navigateByUrl('/login');
  }

  /** Closes the menu when clicking outside the header element. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  /** Closes the menu when the Escape key is pressed. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  /** Computes the avatar label shown for the current user or guest. */
  private getAvatarLabel(): string {
    const user = this.dbService.user();
    if (!user) return 'G';
    if (user.is_anonymous) return 'G';
    const email = user.email?.toLowerCase() ?? '';
    const contact = this.dbService.contactsList().find(item => item.email.toLowerCase() === email);
    return contact?.getInitials() ?? this.getEmailInitial(email);
  }

  /** Returns the uppercased first letter of the email as fallback initial. */
  private getEmailInitial(email: string): string {
    return email.charAt(0).toUpperCase() || 'U';
  }
}
