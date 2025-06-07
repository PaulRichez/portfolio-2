# LLM Chat Plugin - Migration to Persistent Storage

This plugin has been migrated from using buffer memory to persistent database storage using Strapi collection types.

## What Changed

### Before (Buffer Memory)
- Conversations stored in memory using LangChain's BufferMemory
- Data lost on server restart
- No persistent chat history
- Sessions existed only during runtime

### After (Persistent Storage)
- Conversations stored in Strapi database
- Chat history persists across server restarts
- Full session management with titles
- Messages stored with proper relationships

## Database Schema

### Chat Session (`chat-session`)
```json
{
  "sessionId": "unique string identifier",
  "title": "optional user-friendly title",
  "messages": "relation to chat messages"
}
```

### Chat Message (`chat-message`)
```json
{
  "content": "message text content",
  "role": "user | assistant | system", 
  "sessionId": "reference to session",
  "timestamp": "when message was created",
  "session": "relation to chat session"
}
```

## New Features

1. **Persistent Chat History**: All conversations are saved to the database
2. **Session Management**: Create, rename, and delete chat sessions
3. **Message History**: Full conversation history with timestamps
4. **Session Titles**: User-friendly names for chat sessions
5. **Better Organization**: Sessions are ordered by last activity

## API Changes

### New Endpoints
- `DELETE /sessions/:sessionId` - Delete a specific session
- `PUT /sessions/:sessionId/title` - Update session title

### Modified Endpoints
- All existing endpoints now work with database storage
- Response format slightly changed to include session information


## Usage in Frontend

The ChatInterface component has been updated with:
- Session title editing (click to edit)
- Individual session deletion
- Better session overview with titles
- Improved history loading

## Backwards Compatibility

The old `langchainService` is still available if needed, but all controllers now use `persistentChatService` by default. You can switch back by modifying the controller imports if necessary.

## Database Setup

Make sure your Strapi database is running and the plugin content types are properly created. The collections will be automatically created when the plugin starts.

## Performance Notes

- Messages are loaded on-demand per session
- Active conversations are cached in memory for performance
- Database queries are optimized for chat history retrieval
- Consider adding indexes on `sessionId` and `timestamp` for large datasets

## Troubleshooting

1. **Messages not loading**: Check that the database connection is working
2. **Sessions not appearing**: Verify the content types are created in Strapi admin
3. **Performance issues**: Consider adding database indexes for large message volumes
4. **Migration issues**: Use the migration service validation methods

## Development

To test the new persistent storage:

1. Start your Strapi server
2. Open the LLM Chat plugin in admin panel
3. Create a new chat session
4. Send some messages
5. Restart the server
6. Verify messages are still there

The chat history should persist across server restarts, confirming the migration is working correctly.
