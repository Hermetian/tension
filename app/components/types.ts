export interface UserPresence {
    id: string
    email: string
    display_name: string
    avatar_path?: string | null
    status: 'active' | 'idle' | 'offline'
    lastSeen: string
    unreadCount?: number
  }
  
  export interface Message {
    id: number;
    content: string;
    user_id: string;
    username: string;
    channel_id: number;
    created_at: string;
    file?: FileAttachment;
    parent_message_id?: number;  // Add this for threading support
    reactions?: MessageReaction[];
  }
  
  export interface MessageReaction {
    id: number;
    message_id: number;
    user_id: string;
    emoji: string;
    created_at: string;
  }
  
  export interface Channel {
    id: number
    name: string
    description?: string
    created_by: string
    created_at: string
  }
  
  export interface DMChannel {
    id: number
    user1_id: string
    user2_id: string
    created_at: string
    last_message_from?: string
    unread_count?: number
  }
  
  export interface DMMessage {
    id: number;
    content: string;
    sender_id: string;
    dm_channel_id: number;
    created_at: string;
    file?: FileAttachment;
    reactions?: MessageReaction[];
  }

  export type ChatContext = {
    type: 'channel' | 'dm'
    channel?: Channel
    dmChannel?: DMChannel
    otherUser?: UserPresence
  }

  export interface FileAttachment {
    url: string;
    name: string;
    type: string;
    size: number;
  }
