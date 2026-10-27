import { router } from 'expo-router';
import { api, ApiError } from '../api/client';
import { toast } from '../store/feedback';

type Target = { userId: string } | { support: true } | { customerId: string } | { taskId: string; with?: 'customer' | 'technician' };

/** Opens (or starts) the conversation with someone and shows it. */
export async function openChatWith(target: Target) {
  const body = 'taskId' in target ? { taskId: target.taskId, with: target.with ?? 'customer' } : target;
  try {
    const { conversation } = await api<{ conversation: { id: string } }>('/chat/conversations', { body });
    router.push(`/chat/${conversation.id}`);
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Try again';
    if (e instanceof ApiError && e.status === 404 && 'taskId' in target) toast.info('No app account yet', 'This customer has no Optimas app account. Onboard them from the job to chat.');
    else toast.error('Could not open the chat', msg);
  }
}
