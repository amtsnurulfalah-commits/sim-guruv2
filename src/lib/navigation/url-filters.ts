/** Only keys explicitly declared by a screen may enter its URL state. */
export type FilterRules<T extends Record<string, string>> = {
  [K in keyof T]: (value: string) => boolean;
};
export function readUrlFilters<T extends Record<string, string>>(
  search: string,
  defaults: T,
  rules: FilterRules<T>,
): T {
  const params = new URLSearchParams(search);
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const values = params.getAll(key);
    if (values.length === 1 && rules[key](values[0]!))
      result[key] = values[0] as T[typeof key];
  }
  return result;
}
export function writeUrlFilters<T extends Record<string, string>>(
  href: string,
  values: T,
  defaults: T,
  rules: FilterRules<T>,
) {
  const url = new URL(href);
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    url.searchParams.delete(key);
    if (values[key] !== defaults[key] && rules[key](values[key]!))
      url.searchParams.set(key, values[key]!);
  }
  return url.pathname + url.search + url.hash;
}
