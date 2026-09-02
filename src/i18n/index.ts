import type { Locale } from '../../site.config';
import id from './id.json';
import en from './en.json';
import { translate, type Dict } from '../domain/i18n';

const dicts: Record<Locale, Dict> = { id, en };

export const getDict = (locale: Locale): Dict => dicts[locale];
export const t = (locale: Locale) => translate(getDict(locale));
