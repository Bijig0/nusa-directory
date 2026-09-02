/// <reference types="astro/client" />

import type { Locale } from '../site.config';
import type { Dict } from './domain/i18n';
import type { Deps } from './infra/env';
import type { User, Session } from './infra/db/schema';

declare global {
  namespace App {
    interface Locals {
      locale: Locale;
      dict: Dict;
      deps: Deps;
      /** Signed-in user (set by the session middleware). */
      user?: User;
      session?: Session;
      isAdmin: boolean;
    }
  }
}

export {};
