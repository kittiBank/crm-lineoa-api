export const BROADCAST_SEND_QUEUE = 'broadcast.send';
export const AUTO_REPLY_QUEUE = 'auto-reply.process';

export interface BroadcastQueueMessage {
  broadcastId: string;
  userId: string;
}

export interface AutoReplyQueueMessage {
  userId: string;
  lineAccountId: string;
  platformLineUserId: string;
  matchInput: string;
  replyToken?: string;
}
