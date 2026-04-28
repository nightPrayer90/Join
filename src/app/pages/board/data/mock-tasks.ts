import { BoardAssignee, BoardTask } from './board-task.types';

const ANTON: BoardAssignee = { initials: 'AM', fullName: 'Anton Mayer',     color: '#1F7BD5' };
const EMMANUEL: BoardAssignee = { initials: 'EM', fullName: 'Emmanuel Mauer', color: '#1FD7C1' };
const MARCEL: BoardAssignee = { initials: 'MB', fullName: 'Marcel Bauer',    color: '#6E52FF' };

export const MOCK_TASKS: BoardTask[] = [
  {
    id: 'kochwelt-recommender',
    category: 'User Story',
    title: 'Kochwelt Page & Recipe Recommender',
    description: 'Build start page with recipe recommendation.',
    dueDate: '10/05/2023',
    priority: 'medium',
    assignees: [ANTON, EMMANUEL, MARCEL],
    subtasks: [
      { title: 'Implement Recipe Recommendation', done: true },
      { title: 'Start Page Layout', done: false },
    ],
    status: 'in-progress',
  },
  {
    id: 'html-base-template',
    category: 'Technical Task',
    title: 'HTML Base Template Creation',
    description: 'Create reusable HTML base templates.',
    dueDate: '12/05/2023',
    priority: 'low',
    assignees: [ANTON, EMMANUEL, MARCEL],
    subtasks: [],
    status: 'await-feedback',
  },
  {
    id: 'daily-kochwelt-recipe',
    category: 'User Story',
    title: 'Daily Kochwelt Recipe',
    description: 'Implement daily recipe and portion calculator.',
    dueDate: '20/05/2023',
    priority: 'medium',
    assignees: [ANTON, EMMANUEL, MARCEL],
    subtasks: [],
    status: 'await-feedback',
  },
  {
    id: 'css-architecture-planning',
    category: 'Technical Task',
    title: 'CSS Architecture Planning',
    description: 'Define CSS naming conventions and structure.',
    dueDate: '08/05/2023',
    priority: 'urgent',
    assignees: [ANTON, EMMANUEL, MARCEL],
    subtasks: [
      { title: 'Establish CSS Methodology', done: true },
      { title: 'Setup Base Styles', done: true },
    ],
    status: 'done',
  },
];
