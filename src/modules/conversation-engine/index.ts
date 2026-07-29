/**
 * conversation-engine: owns conversation thread state, clarification flow, marketing-mode behavior.
 * Orchestrates ai-agent (interpret) -> campaign-manager / website-analyzer (execute) -> storage.
 */

import { interpret } from '../ai-agent';
import { applyToolCall } from '../campaign-manager';
import { analyzeWebsite } from '../website-analyzer';
import { aiQueue } from '../queue-manager';
import { conversationsRepo } from '../storage';
import { generateId, nowISO } from '@/lib/id';
import type { AgentToolCall, ChatMessage, Conversation, Message } from '@/types';

export async function listConversations(): Promise<Conversation[]> {
  const all = await conversationsRepo.getAll();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return conversationsRepo.get(id);
}

export async function createConversation(title = 'New conversation'): Promise<Conversation> {
  const now = nowISO();
  const conversation: Conversation = {
    id: generateId(),
    title,
    messages: [],
    pendingClarifications: [],
    relatedCampaignIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await conversationsRepo.put(conversation);
  return conversation;
}

function toChatHistory(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({
    role: m.role === 'agent' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
    content: m.text,
  }));
}

async function executeToolCall(call: AgentToolCall, conversationId: string): Promise<AgentToolCall> {
  if (call.name === 'analyze_website') {
    try {
      const url = (call.arguments as { url?: string }).url;
      if (!url) throw new Error('No URL provided');
      const analysis = await analyzeWebsite(url);
      return { ...call, result: { analysis }, status: 'applied' };
    } catch (error) {
      return {
        ...call,
        result: { error: error instanceof Error ? error.message : String(error) },
        status: 'failed',
      };
    }
  }
  return applyToolCall(call, conversationId);
}

/**
 * Sends a user message, runs it through the AI agent, executes any proposed
 * tool calls, and persists the resulting conversation state. Returns the
 * updated conversation for the UI to render.
 */
export async function sendMessage(conversationId: string, text: string): Promise<Conversation> {
  const conversation = await conversationsRepo.get(conversationId);
  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);

  const userMessage: Message = { id: generateId(), role: 'user', text, createdAt: nowISO() };
  conversation.messages.push(userMessage);

  const response = await aiQueue.enqueue(() => interpret(toChatHistory(conversation.messages)));

  const appliedToolCalls: AgentToolCall[] = [];
  if (response.toolCalls?.length) {
    for (const call of response.toolCalls) {
      const applied = await executeToolCall(call, conversationId);
      appliedToolCalls.push(applied);
      if (applied.status === 'applied') {
        const result = applied.result as { campaignIds?: string[]; campaign?: { id: string } };
        const ids = result.campaignIds ?? (result.campaign ? [result.campaign.id] : []);
        for (const id of ids) {
          if (!conversation.relatedCampaignIds.includes(id)) {
            conversation.relatedCampaignIds.push(id);
          }
        }
      }
    }
  }

  const agentMessage: Message = {
    id: generateId(),
    role: 'agent',
    text: response.message.content || summarizeToolCalls(appliedToolCalls),
    toolCalls: appliedToolCalls.length ? appliedToolCalls : undefined,
    createdAt: nowISO(),
  };
  conversation.messages.push(agentMessage);
  conversation.updatedAt = nowISO();
  if (conversation.title === 'New conversation' && conversation.messages.length <= 2) {
    conversation.title = text.slice(0, 60);
  }

  await conversationsRepo.put(conversation);
  return conversation;
}

function summarizeToolCalls(calls: AgentToolCall[]): string {
  if (calls.length === 0) return "I didn't have a response for that — try rephrasing.";
  const failed = calls.filter((c) => c.status === 'failed');
  if (failed.length) {
    return `Something went wrong: ${failed.map((f) => (f.result as { error?: string })?.error).join('; ')}`;
  }
  return 'Done.';
}
