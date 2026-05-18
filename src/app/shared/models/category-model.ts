import { Category } from '../interface/tasks-interface';

export class CategoryModel implements Category {
  id: number;
  name: string;
  color: string;

  /** Static list of all available categories. */
  static readonly LIST: CategoryModel[] = [
    new CategoryModel({ id: 1, name: 'Technical Task', color: '#1FD7C1' }),
    new CategoryModel({ id: 2, name: 'User Story', color: '#0038FF' }),
  ];

  /** Builds a CategoryModel from a partial category record, applying defaults for missing fields. */
  constructor(data: Partial<Category> = {}) {
    this.id = data.id ?? -1;
    this.name = data.name ?? 'n/a';
    this.color = data.color ?? '#FFFFFF';
  }

  /**
   * Finds a category by its id.
   * @param id - Category id
   * @returns The matching CategoryModel or null if not found
   */
  static findById(id: number| null): CategoryModel | null {
    if (id === null) return null;
    return CategoryModel.LIST.find((category) => category.id === id) ?? null;
  }
}
