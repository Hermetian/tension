# Database Schema Documentation

## Overview
This schema represents a messaging/chat application with support for both channel-based communication and direct messages (DMs). The database is structured around four main tables: messages, channels, dm_channels, and user_status.

## Tables

### Messages
Main table for storing channel messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | int8 | Primary Key | Unique message identifier |
| created_at | timestamptz | Non-Nullable | When the message was created |
| content | text | Non-Nullable | The message content |
| user_id | uuid | Non-Nullable | ID of the user who sent the message |
| username | text | Non-Nullable | Username of the sender |
| channel_id | int8 | Non-Nullable | ID of the channel where message was sent |
| file | jsonb | Nullable | Optional file attachments |
| parent_message_id | int8 | Nullable | ID of the parent message (for replies) |

### Channels
Represents public/group chat channels.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | int8 | Primary Key | Unique channel identifier |
| created_at | timestamptz | Non-Nullable | When the channel was created |
| name | text | Non-Nullable | Channel name |
| description | text | Nullable | Channel description |
| created_by | uuid | Non-Nullable | ID of the user who created the channel |

### DM Channels (dm_channels)
Represents direct message conversations between two users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | int8 | Primary Key | Unique DM channel identifier |
| created_at | timestamptz | Non-Nullable | When the DM channel was created |
| user1_id | uuid | Non-Nullable | ID of the first user |
| user2_id | uuid | Non-Nullable | ID of the second user |
| unread_count | int8 | Nullable | Number of unread messages |
| last_message_from | uuid | Nullable | ID of user who sent the last message |

### DM Messages (dm_messages)
Stores messages sent in direct message conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | int8 | Primary Key | Unique message identifier |
| created_at | timestamptz | Non-Nullable | When the message was created |
| content | text | Non-Nullable | The message content |
| sender_id | uuid | Non-Nullable | ID of the message sender |
| dm_channel_id | int8 | Non-Nullable | ID of the DM channel |
| file | jsonb | Nullable | Optional file attachments |

### User Status (user_status)
Tracks user presence and status information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | uuid | Primary Key | User identifier |
| email | text | Non-Nullable | User's email address |
| last_seen | timestamptz | Non-Nullable | When the user was last active |
| status | text | Non-Nullable | Current user status |
| created_at | timestamptz | Non-Nullable | When the status record was created |

## Relationships

- Messages reference channels through `channel_id`
- Messages reference users through `user_id`
- DM messages reference dm_channels through `dm_channel_id`
- DM messages reference users through `sender_id`
- DM channels reference users through both `user1_id` and `user2_id`
- Channels reference their creator through `created_by`
- User status references users through `user_id`

All user-related fields (user_id, sender_id, created_by, etc.) reference the `auth.users.id` from Supabase's built-in authentication system.