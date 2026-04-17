export const DEFAULT_TRIP_CURRENCY = 'USD';

export interface TripCurrencyOption {
  code: string;
  label: string;
}

export const TRIP_CURRENCY_OPTIONS: TripCurrencyOption[] = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'INR', label: 'Indian Rupee (INR / Rs)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
];

export function normalizeTripCurrency(currency?: string | null): string {
  if (!currency) {
    return DEFAULT_TRIP_CURRENCY;
  }

  const code = currency.trim().toUpperCase();
  const exists = TRIP_CURRENCY_OPTIONS.some((option) => option.code === code);
  return exists ? code : DEFAULT_TRIP_CURRENCY;
}

export function formatTripAmount(amount: number, currency?: string): string {
  const code = normalizeTripCurrency(currency);

  if (code === 'INR') {
    return `Rs ${amount.toFixed(2)}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}
