-- Optimization: Add indexes for Chat sidebar lookups
-- These indexes significantly speed up finding the latest message and counting unread messages per room/participant

CREATE INDEX idx_chat_message_room_latest ON chat_message (project_id, room_id, id DESC) WHERE room_id IS NOT NULL;

CREATE INDEX idx_chat_message_direct_latest ON chat_message (project_id, sender, recipient, id DESC) WHERE recipient IS NOT NULL;

-- Index for unread count batching
CREATE INDEX idx_chat_message_unread_count ON chat_message (project_id, room_id, sender, id DESC);
