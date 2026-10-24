"use client";
import { useUrlFilters } from "../../src/lib/navigation/use-url-filters";
const defaults = { page: "1", state: "active" };
const rules = {
  page: (v: string) => /^[1-9]\d{0,5}$/.test(v),
  state: (v: string) => ["active", "closed"].includes(v),
};
export function FilterProbe() {
  const [filters, update] = useUrlFilters(defaults, rules);
  return (
    <section aria-label="Filter URL fixture">
      <label>
        Status fixture
        <select
          value={filters.state}
          onChange={(event) => update({ state: event.target.value, page: "1" })}
        >
          <option value="active">Aktif</option>
          <option value="closed">Ditutup</option>
        </select>
      </label>
      <p data-testid="url-context">
        {filters.state}:{filters.page}
      </p>
      <button
        type="button"
        onClick={() => update({ page: String(Number(filters.page) + 1) })}
      >
        Halaman fixture berikutnya
      </button>
      <button type="button" onClick={() => update(defaults)}>
        Reset fixture
      </button>
    </section>
  );
}
