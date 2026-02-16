export interface ChatMessage {
  sender: string;
  content: string;
  timestamp?: string;
  recipient?: string;
  type?: 'CHAT' | 'JOIN' | 'LEAVE';
}

export interface User {
  username: string;
  email?: string; 
}