import { motion } from 'framer-motion';
import type { Message } from '@/types';

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-raised text-white/90 ring-1 ring-surface-border'
        }`}
      >
        {message.text}
        {message.toolCalls?.some((c) => c.status === 'applied') && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.toolCalls
              .filter((c) => c.status === 'applied')
              .map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70"
                >
                  {c.name.replace(/_/g, ' ')}
                </span>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
