import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useConversation, useConversations, useCreateConversation, useSendMessage } from '@/store/queries';
import { MessageBubble } from '../components/MessageBubble';
import { ChatComposer } from '../components/ChatComposer';

export function ChatView() {
  const { activeConversationId, setActiveConversationId, setAgentThinking, isAgentThinking } =
    useAppStore();
  const { data: conversations = [] } = useConversations();
  const { data: conversation } = useConversation(activeConversationId);
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations, setActiveConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  const handleSend = async (text: string) => {
    let conversationId = activeConversationId;
    if (!conversationId) {
      const created = await createConversation.mutateAsync(undefined);
      conversationId = created.id;
      setActiveConversationId(conversationId);
    }
    setAgentThinking(true);
    try {
      await sendMessage.mutateAsync({ conversationId, text });
    } finally {
      setAgentThinking(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {(!conversation || conversation.messages.length === 0) && (
          <div className="mx-auto mt-16 max-w-sm text-center text-white/50">
            <p className="text-base font-medium text-white/80">
              Hire your Pinterest Ads specialist.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed">
              Describe what you want — “Create 3 campaigns for my recipe website” — and
              I’ll ask what I need to know, then plan and build it with you.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {conversation?.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isAgentThinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-surface-raised px-4 py-2.5 text-[13px] text-white/40 ring-1 ring-surface-border">
                Thinking…
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>
      <ChatComposer onSend={handleSend} disabled={isAgentThinking} />
    </div>
  );
}
