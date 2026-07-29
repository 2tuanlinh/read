'use client';

import { useState } from 'react';

export default function SuggestionInput({ value, onChange, suggestions, placeholder }) {
  const [open, setOpen] = useState(false);
  const matches = suggestions
    .filter((suggestion) => !value || suggestion.toLocaleLowerCase().includes(value.toLocaleLowerCase()))
    .slice(0, 8);

  return (
    <div className="suggestion-input">
      <input value={value} onChange={(event) => { onChange(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} placeholder={placeholder} autoComplete="off" aria-autocomplete="list" aria-expanded={open && matches.length > 0} />
      {open && matches.length > 0 && <div className="suggestion-menu" role="listbox">
        {matches.map((suggestion) => <button key={suggestion} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(suggestion); setOpen(false); }}>{suggestion}</button>)}
      </div>}
    </div>
  );
}
