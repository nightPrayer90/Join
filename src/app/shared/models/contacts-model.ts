import { Contact } from '../interface/contact-interface';

export class ContactsModel implements Contact {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  avatar_color: string;
  isUser: boolean;

  constructor(data: Partial<Contact> = {}) {
    this.id = data.id ?? -1;
    this.full_name = data.full_name ?? "n/a";
    this.email = data.email ?? "n/a";
    this.phone = data.phone ?? "n/a";
    this.avatar_color = data.avatar_color ?? "#FFFFFF";
    this.isUser = data.isUser ?? false;
  }

  getCleanAddJson() {
    return {
        full_name: this.full_name,
        email: this.email,
        phone: this.phone,
        avatar_color: this.avatar_color,
        isUser: this.isUser
    }
  }

  getInitials(): string {
    const parts = this.full_name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return `${first}${second || first}`.toUpperCase();
  }
}
