/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

import type { Locale } from '../site.config';
import type { Dict } from './domain/i18n';
import type { Deps } from './infra/env';

declare global {
  namespace App {
    interface Locals {
      cfContext: ExecutionContext;
      locale: Locale;
      dict: Dict;
      deps: Deps;
    }
  }
}

export {};
