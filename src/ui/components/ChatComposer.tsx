import { useState, type KeyboardEvent } from 'react';

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-surface-border bg-surface p-3">
      <div className="flex items-end gap-2 rounded-2xl bg-surface-raised px-3 py-2 ring-1 ring-surface-border focus-within:ring-white/20">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Tell PinAds what to do — e.g. “Create 3 campaigns for vegiplate.online”"
          className="max-h-32 flex-1 resize-none bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-30"
        >
          Send
        </button>
      </div>
    </div>
  );
}
