import { Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./auth/login/login').then(m => m.Login) },
  { path: 'signup', loadComponent: () => import('./auth/signup/signup').then(m => m.Signup) },
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'summary', pathMatch: 'full' },
      { path: 'summary', canActivate: [authGuard], loadComponent: () => import('./pages/summary/summary').then(m => m.Summary) },
      { path: 'summary/:fromLogin', canActivate: [authGuard], loadComponent: () => import('./pages/summary/summary').then(m => m.Summary) },
      { path: 'board', canActivate: [authGuard], loadComponent: () => import('./pages/board/board').then(m => m.Board) },
      { path: 'add-task', canActivate: [authGuard], loadComponent: () => import('./pages/add-task/add-task').then(m => m.AddTask) },
      { path: 'contacts', canActivate: [authGuard], loadComponent: () => import('./pages/contacts/contacts').then(m => m.Contacts) },
      { path: 'help', canActivate: [authGuard], loadComponent: () => import('./pages/help/help').then(m => m.Help) },
      { path: 'privacy-policy', loadComponent: () => import('./pages/privacy-policy/privacy-policy').then(m => m.PrivacyPolicy) },
      { path: 'legal-notice', loadComponent: () => import('./pages/legal-notice/legal-notice').then(m => m.LegalNotice) },
    ],
  },
];
