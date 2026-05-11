import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Supabase } from '../service/supabase';

export const authGuard: CanActivateFn = async () => {
  const dbService = inject(Supabase);
  const router = inject(Router);
  if (await dbService.hasActiveSession()) return true;
  return router.createUrlTree(['/login']);
};
