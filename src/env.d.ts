/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

import type { Locale } from '../site.config';
import type { Dict } from './domain/i18n';
import type { Deps } from './infra/env';
import type { User, Session } from './infra/db/schema';

declare global {
  namespace App {
    interface Locals {
      cfContext: ExecutionContext;
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
