import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../service/supabase';

/** Route guard that allows navigation only when an active Supabase session exists. */
export const authGuard: CanActivateFn = async () => {
  const dbService = inject(Supabase);
  const router = inject(Router);
  if (await dbService.hasActiveSession()) return true;
  return router.createUrlTree(['/login']);
};
