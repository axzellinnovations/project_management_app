export interface ChatMessage {
  id?: number;
  sender: string;
  content: string;
  timestamp?: string;
  recipient?: string;
  type?: 'CHAT' | 'JOIN' | 'LEAVE';
  roomId?: number;
}

export interface User {
  username: string;
  email?: string;
}

export interface ChatRoom {
  id: number;
  name: string;
  projectId: number;
  createdBy: string;
}
