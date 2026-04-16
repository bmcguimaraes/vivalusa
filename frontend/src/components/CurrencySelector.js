import React from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

export default function CurrencySelector() {
  const { currency, changeCurrency, availableCurrencies, symbol } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="currency-selector"
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-body text-[#A1A1AA] hover:text-white border border-[#27272A] rounded-md bg-transparent hover:bg-[#18181B] transition-colors"
        >
          {symbol} {currency}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#18181B] border-[#27272A] max-h-64 overflow-y-auto">
        {availableCurrencies.map(c => (
          <DropdownMenuItem
            key={c}
            data-testid={`currency-${c}`}
            onClick={() => changeCurrency(c)}
            className={`text-xs font-body cursor-pointer ${currency === c ? 'text-[#D4AF37]' : 'text-white'} hover:bg-[#27272A]`}
          >
            {c}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
