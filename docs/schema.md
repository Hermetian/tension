# Database Schema Documentation

## Overview
This schema represents a messaging/chat application with support for channel-based communication, direct messages (DMs), and emoji reactions to messages. The database is structured around five main tables: `messages`, `channels`, `dm_channels`, `user_status`, and `message_reactions`.

## Tables

### Messages
Main table for storing channel messages.

| Column             | Type       | Constraints                        | Description                                       |
|--------------------|------------|------------------------------------|---------------------------------------------------|
| id                 | int8       | Primary Key                        | Unique message identifier                         |
| created_at         | timestamptz| Non-Nullable                       | When the message was created                      |
| content            | text       | Non-Nullable                       | The message content                               |
| user_id            | uuid       | Non-Nullable                       | ID of the user who sent the message               |
| username           | text       | Non-Nullable                       | Username of the sender                            |
| channel_id         | int8       | Non-Nullable                       | ID of the channel where message was sent          |
| file               | jsonb      | Nullable                           | Optional file attachments                         |
| parent_message_id  | int8       | Nullable                           | ID of the parent message (for replies)            |

### Channels
Represents public/group chat channels.

| Column     | Type       | Constraints   | Description                            |
|------------|------------|---------------|----------------------------------------|
| id         | int8       | Primary Key   | Unique channel identifier              |
| created_at | timestamptz| Non-Nullable  | When the channel was created           |
| name       | text       | Non-Nullable  | Channel name                           |
| description| text       | Nullable      | Channel description                    |
| created_by | uuid       | Non-Nullable  | ID of the user who created the channel |

### DM Channels (dm_channels)
Represents direct message conversations between two users.

| Column            | Type       | Constraints                      | Description                                |
|-------------------|------------|-----------------------------------|--------------------------------------------|
| id                | int8       | Primary Key                       | Unique DM channel identifier               |
| created_at        | timestamptz| Non-Nullable                      | When the DM channel was created            |
| user1_id          | uuid       | Non-Nullable                      | ID of the first user                       |
| user2_id          | uuid       | Non-Nullable                      | ID of the second user                      |
| unread_count      | int8       | Nullable                          | Number of unread messages                  |
| last_message_from | uuid       | Nullable                          | ID of user who sent the last message       |

### DM Messages (dm_messages)
Stores messages sent in direct message conversations.

| Column        | Type       | Constraints                      | Description                        |
|---------------|------------|-----------------------------------|------------------------------------|
| id            | int8       | Primary Key                       | Unique message identifier          |
| created_at    | timestamptz| Non-Nullable                      | When the message was created       |
| content       | text       | Non-Nullable                      | The message content                |
| sender_id     | uuid       | Non-Nullable                      | ID of the message sender           |
| dm_channel_id | int8       | Non-Nullable                      | ID of the DM channel               |
| file          | jsonb      | Nullable                          | Optional file attachments          |

### User Status (user_status)
Tracks user presence and status information.

| Column      | Type       | Constraints                        | Description                 |
|-------------|------------|------------------------------------|-----------------------------|
| user_id     | uuid       | Primary Key                        | User identifier             |
| email       | text       | Non-Nullable                       | User's email address        |
| display_name| text       | Non-Nullable, Default: email       | User's display name         |
| bot_prompt  | text       | Nullable                           | User's custom bot prompt    |
| last_seen   | timestamptz| Non-Nullable                       | When the user was last active|
| status      | text       | Non-Nullable                       | Current user status         |
| created_at  | timestamptz| Non-Nullable                       | When the status record was created |

### Message Reactions (message_reactions)
Stores emoji reactions to messages.

| Column     | Type       | Constraints                                       | Description                            |
|------------|------------|---------------------------------------------------|----------------------------------------|
| id         | int8       | Primary Key                                       | Unique reaction identifier             |
| message_id | int8       | Non-Nullable, Foreign Key (`messages.id`)         | ID of the message being reacted to     |
| user_id    | uuid       | Non-Nullable, Foreign Key (`user_status.user_id`) | ID of the user who added the reaction  |
| emoji      | text       | Non-Nullable                                      | Emoji used in the reaction             |
| created_at | timestamptz| Non-Nullable, Default: `NOW()`                    | When the reaction was added            |

**Unique Constraints:**
- A unique constraint on (`message_id`, `user_id`) ensures that a user can only have one reaction per message. If a user reacts again, their previous reaction is updated.

## Relationships

- **Messages** reference **Channels** through `channel_id`.
- **Messages** reference **Users** through `user_id`.
- **Messages** can reference other messages through `parent_message_id` (for replies).
- **Message Reactions** reference **Messages** through `message_id`.
- **Message Reactions** reference **Users** through `user_id`.
- **DM Messages** reference **DM Channels** through `dm_channel_id`.
- **DM Messages** reference **Users** through `sender_id`.
- **DM Channels** reference **Users** through both `user1_id` and `user2_id`.
- **Channels** reference their creator through `created_by`.
- **User Status** references **Users** through `user_id`.

All user-related fields (`user_id`, `sender_id`, `created_by`, etc.) reference the `auth.users.id` from Supabase's built-in authentication system.

## Notes

- **Message Reactions:**
  - The `message_reactions` table allows users to react to messages using emojis.
  - Each reaction stores the emoji and the user who reacted.
  - The unique constraint ensures that a user can only have one reaction per message; reacting again will update the existing reaction.

- **Foreign Key Constraints:**
  - `message_reactions.message_id` references `messages.id`.
  - `message_reactions.user_id` references `user_status.user_id`.

## Diagram (Optional)

If you maintain an ER (Entity-Relationship) diagram, consider adding the `message_reactions` table connected to the `messages` and `user_status` tables to visualize the relationships.