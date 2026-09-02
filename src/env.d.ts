/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

import type { Locale } from '../site.config';
import type { Dict } from './domain/i18n';

declare global {
  namespace App {
    interface Locals {
      cfContext: ExecutionContext;
      locale: Locale;
      dict: Dict;
    }
  }
}

export {};
