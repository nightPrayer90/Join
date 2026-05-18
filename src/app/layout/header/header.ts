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

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update(value => !value);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  async logout(): Promise<void> {
    this.closeMenu();
    await this.dbService.logout();
    await this.router.navigateByUrl('/login');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  private getAvatarLabel(): string {
    const user = this.dbService.user();
    if (!user) return 'G';
    if (user.is_anonymous) return 'G';
    const email = user.email?.toLowerCase() ?? '';
    const contact = this.dbService.contactsList().find(item => item.email.toLowerCase() === email);
    return contact?.getInitials() ?? this.getEmailInitial(email);
  }

  private getEmailInitial(email: string): string {
    return email.charAt(0).toUpperCase() || 'U';
  }
}
