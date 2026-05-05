import { BoardAssignee, BoardTask } from './board-task.types';

const ANTON: BoardAssignee = { initials: 'AM', fullName: 'Anton Mayer',     color: '#1F7BD5' };
const EMMANUEL: BoardAssignee = { initials: 'EM', fullName: 'Emmanuel Mauer', color: '#1FD7C1' };
const MARCEL: BoardAssignee = { initials: 'MB', fullName: 'Marcel Bauer',    color: '#6E52FF' };

export const MOCK_TASKS: BoardTask[] = [
  {
    id: 'kochwelt-recommender',
    category: null,
    title: 'Kochwelt Page & Recipe Recommender',
    description: 'Build start page with recipe recommendation.',
    dueDate: '10/05/2023',
    priority: 'medium',
    assignees: [ANTON, EMMANUEL, MARCEL],
    memberIds: [],
    subtasks: [
      { id: 1, title: 'Implement Recipe Recommendation', done: true },
      { id: 2, title: 'Start Page Layout', done: false },
    ],
    status: 'in-progress',
    sortOrder: 0,
  },
  {
    id: 'html-base-template',
    category: null,
    title: 'HTML Base Template Creation',
    description: 'Create reusable HTML base templates.',
    dueDate: '12/05/2023',
    priority: 'low',
    assignees: [ANTON, EMMANUEL, MARCEL],
    memberIds: [],
    subtasks: [],
    status: 'await-feedback',
    sortOrder: 0,
  },
  {
    id: 'daily-kochwelt-recipe',
    category: null,
    title: 'Daily Kochwelt Recipe',
    description: 'Implement daily recipe and portion calculator.',
    dueDate: '20/05/2023',
    priority: 'medium',
    assignees: [ANTON, EMMANUEL, MARCEL],
    memberIds: [],
    subtasks: [],
    status: 'await-feedback',
    sortOrder: 1,
  },
  {
    id: 'css-architecture-planning',
    category: null,
    title: 'CSS Architecture Planning',
    description: 'Define CSS naming conventions and structure.',
    dueDate: '08/05/2023',
    priority: 'urgent',
    assignees: [ANTON, EMMANUEL, MARCEL],
    memberIds: [],
    subtasks: [
      { id: 1, title: 'Establish CSS Methodology', done: true },
      { id: 2, title: 'Setup Base Styles', done: true },
    ],
    status: 'done',
    sortOrder: 0,
  },
];
