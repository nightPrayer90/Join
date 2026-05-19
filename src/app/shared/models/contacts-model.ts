import { Contact } from '../interface/contact-interface';

/**
 * Model representing a contact entity from the database.
 * Provides helper methods for data transformation and UI usage.
 */
export class ContactsModel implements Contact {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  avatar_color: string;
  isUser: boolean;

  /** Builds a ContactsModel from a partial database record, applying defaults for missing fields. */
  constructor(data: Partial<Contact> = {}) {
    this.id = data.id ?? -1;
    this.full_name = data.full_name ?? 'n/a';
    this.email = data.email ?? 'n/a';
    this.phone = data.phone ?? 'n/a';
    this.avatar_color = data.avatar_color ?? '#FFFFFF';
    this.isUser = data.isUser ?? false;
  }

  /**
   * Returns a cleaned JSON object for creating a new contact in the database.
   * @returns {object} Task payload for insert operations
   */
  getCleanAddJson(): object {
    return {
      full_name: this.full_name,
      email: this.email,
      phone: this.phone,
      avatar_color: this.avatar_color,
      isUser: this.isUser,
    };
  }

  /**
   * Returns a cleaned JSON object for updating an existing contact in the database.
   * @returns {object} Task payload for update operations
   */
  getCleanUpdateJson(): object {
    return {
      full_name: this.full_name,
      email: this.email,
      phone: this.phone,
    };
  }

  /**
   * Generates initials from the full name.
   * Uses first and last name initials.
   * Falls back to repeating the first letter if only one name is present.
   */
  getInitials(): string {
    const parts = this.full_name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const last = parts[parts.length - 1]?.charAt(0) || '';
    return `${first}${last || first}`.toUpperCase();
  }

  /** Returns the contact name with "(You)" suffix if the email matches the current user. */
  getDisplayName(currentUserEmail: string | null): string {
    if (!currentUserEmail) return this.full_name;
    if (currentUserEmail.toLowerCase() === this.email.toLowerCase())
      return `${this.full_name} (you)`;
    return this.full_name;
  }

  isContactUser(currentUserEmail: string | undefined): boolean {
    if (currentUserEmail?.toLowerCase() === this.email.toLowerCase()) return true;
    return false;
  }

  /** Normalizes email values before comparing or saving them.  */
  getNormalizeEmail(): string {
    return ContactsModel.normalizeEmail(this.email);
  }

  /** Normalizes any email value before comparing or saving it. */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
