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
   * @returns Uppercase initials (e.g. "JD")
   */
  getInitials(): string {
    const parts = this.full_name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const last = parts[parts.length - 1]?.charAt(0) || '';
    return `${first}${last || first}`.toUpperCase();
  }
}
