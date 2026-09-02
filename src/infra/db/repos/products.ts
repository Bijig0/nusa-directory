import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { products, type Product, type ProductCode } from '../schema';

export const activeProducts = (db: Db): Promise<Product[]> =>
  db.select().from(products).where(eq(products.isActive, true)).orderBy(asc(products.sortOrder));

export const allProducts = (db: Db): Promise<Product[]> => db.select().from(products).orderBy(asc(products.sortOrder));

export const findProductByCode = (db: Db, code: ProductCode) =>
  db.select().from(products).where(eq(products.code, code)).get();
