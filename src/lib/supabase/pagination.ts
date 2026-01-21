import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * Fetch all rows from a Supabase query using pagination
 * Handles PostgREST's default 1000 row limit by fetching in pages
 */
export async function fetchAll<T>(
  query: any
): Promise<T[]> {
  const pageSize = 1000;
  const allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      hasMore = data.length === pageSize;
      from += pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}
