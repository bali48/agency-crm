// Supported currencies with default conversion rates to USD (base)
export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD - US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR - Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP - British Pound' },
  { code: 'PKR', symbol: '₨', label: 'PKR - Pakistani Rupee' },
  { code: 'AED', symbol: 'د.إ', label: 'AED - UAE Dirham' },
  { code: 'SAR', symbol: '﷼', label: 'SAR - Saudi Riyal' },
  { code: 'INR', symbol: '₹', label: 'INR - Indian Rupee' },
  { code: 'CAD', symbol: 'C$', label: 'CAD - Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD - Australian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'JPY - Japanese Yen' },
  { code: 'CNY', symbol: '¥', label: 'CNY - Chinese Yuan' },
  { code: 'MXN', symbol: 'MX$', label: 'MXN - Mexican Peso' },
  { code: 'BRL', symbol: 'R$', label: 'BRL - Brazilian Real' },
  { code: 'ZAR', symbol: 'R', label: 'ZAR - South African Rand' },
  { code: 'SGD', symbol: 'S$', label: 'SGD - Singapore Dollar' },
];

export const DEFAULT_RATES = {
  USD: 1.0, EUR: 1.08, GBP: 1.27, PKR: 0.0036, AED: 0.27, SAR: 0.27,
  INR: 0.012, CAD: 0.73, AUD: 0.66, JPY: 0.0065, CNY: 0.14,
  MXN: 0.058, BRL: 0.20, ZAR: 0.054, SGD: 0.74,
};

export const getCurrencySymbol = (code) => {
  const c = CURRENCIES.find(x => x.code === code);
  return c ? c.symbol : '$';
};

export const formatCurrency = (amount, code = 'USD') => {
  const symbol = getCurrencySymbol(code);
  const value = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount || 0);
  return `${symbol}${value}`;
};

export const formatUSD = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);
};
