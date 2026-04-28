import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const CurrencyContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CURRENCY_SYMBOLS = {
  EUR: '\u20AC', USD: '$', GBP: '\u00A3', CHF: 'CHF', SEK: 'kr',
  JPY: '\u00A5', CAD: 'CA$', AUD: 'A$', BRL: 'R$', PLN: 'z\u0142',
  NOK: 'kr', DKK: 'kr', CZK: 'K\u010D', HUF: 'Ft', TRY: '\u20BA'
};

const POPULAR_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'TRY', 'CAD', 'AUD', 'BRL', 'JPY'];

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => localStorage.getItem('vivalusa_currency') || 'EUR');
  const [rates, setRates] = useState({ EUR: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/currency/rates`)
      .then(res => { if (res.data?.rates && typeof res.data.rates === 'object') setRates(res.data.rates); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const changeCurrency = useCallback((newCurrency) => {
    setCurrency(newCurrency);
    localStorage.setItem('vivalusa_currency', newCurrency);
  }, []);

  const convert = useCallback((priceInEur) => {
    const rate = rates[currency] || 1;
    return Math.round(priceInEur * rate * 100) / 100;
  }, [currency, rates]);

  const format = useCallback((priceInEur) => {
    const converted = convert(priceInEur);
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    if (['JPY', 'HUF'].includes(currency)) {
      return `${symbol}${Math.round(converted)}`;
    }
    return `${symbol}${converted.toFixed(2)}`;
  }, [convert, currency]);

  return (
    <CurrencyContext.Provider value={{
      currency, changeCurrency, convert, format,
      rates, loading, symbol: CURRENCY_SYMBOLS[currency] || currency,
      availableCurrencies: POPULAR_CURRENCIES
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
