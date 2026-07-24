export const BROADCAST_SEND_QUEUE = 'broadcast.send';

export interface BroadcastQueueMessage {
  broadcastId: string;
  userId: string;
}
