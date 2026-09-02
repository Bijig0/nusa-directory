import { asc, eq, and } from 'drizzle-orm';
import type { Db } from '../client';
import { areas, categories, cities, servicesCatalog, type Area, type Category, type City, type ServiceItem } from '../schema';

export interface Geo {
  cities: readonly City[];
  areasByCity: ReadonlyMap<string, readonly Area[]>;
  categories: readonly Category[];
  services: readonly ServiceItem[];
}

/** Loads the whole taxonomy (a few hundred rows) in one batch; cached per request. */
export const loadGeo = async (db: Db): Promise<Geo> => {
  const [cityRows, areaRows, categoryRows, serviceRows] = await db.batch([
    db.select().from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder)),
    db.select().from(areas).where(eq(areas.isActive, true)).orderBy(asc(areas.sortOrder), asc(areas.nameId)),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(servicesCatalog).orderBy(asc(servicesCatalog.sortOrder)),
  ]);
  const areasByCity = new Map<string, Area[]>();
  for (const area of areaRows) {
    const list = areasByCity.get(area.cityId) ?? [];
    list.push(area);
    areasByCity.set(area.cityId, list);
  }
  return { cities: cityRows, areasByCity, categories: categoryRows, services: serviceRows };
};

export const findCity = (geo: Geo, slug: string): City | undefined => geo.cities.find((c) => c.slug === slug);
export const findCategory = (geo: Geo, slug: string): Category | undefined => geo.categories.find((c) => c.slug === slug);
export const findArea = (geo: Geo, cityId: string, slug: string): Area | undefined =>
  geo.areasByCity.get(cityId)?.find((a) => a.slug === slug);
export const areasOf = (geo: Geo, cityId: string): readonly Area[] => geo.areasByCity.get(cityId) ?? [];
export const cityById = (geo: Geo, id: string): City | undefined => geo.cities.find((c) => c.id === id);
export const categoryById = (geo: Geo, id: string): Category | undefined => geo.categories.find((c) => c.id === id);
export const areaById = (geo: Geo, id: string | null): Area | undefined =>
  id === null ? undefined : [...geo.areasByCity.values()].flat().find((a) => a.id === id);

export const findAreaRow = (db: Db, cityId: string, slug: string) =>
  db.select().from(areas).where(and(eq(areas.cityId, cityId), eq(areas.slug, slug))).get();
