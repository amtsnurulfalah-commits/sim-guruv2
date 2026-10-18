import Decimal from "decimal.js";
// Constructor terisolasi; konfigurasi library tidak diubah global oleh request.
export const DomainDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
