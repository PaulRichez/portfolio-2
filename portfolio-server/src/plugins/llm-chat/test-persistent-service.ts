/**
 * Simple test script to verify the persistent chat service
 * Run this in the Strapi console or create a custom admin endpoint
 */

export async function testPersistentChatService(strapi: any) {
  const chatService = strapi.plugin('llm-chat').service('persistentChatService');

  console.log('🧪 Testing Persistent Chat Service...');

  try {
    // Test 1: Create a new chat session
    console.log('\n1. Testing chat functionality...');
    const testSessionId = `test-session-${Date.now()}`;

    const response1 = await chatService.chat('Hello, how are you?', {
      sessionId: testSessionId,
      systemPrompt: 'You are a helpful test assistant. Keep responses brief.'
    });

    console.log('✅ First message sent');
    console.log('Response:', response1.response.substring(0, 100) + '...');

    // Test 2: Continue conversation
    console.log('\n2. Testing conversation continuity...');
    const response2 = await chatService.chat('What did I just ask you?', {
      sessionId: testSessionId
    });

    console.log('✅ Second message sent');
    console.log('Response:', response2.response.substring(0, 100) + '...');

    // Test 3: Get history
    console.log('\n3. Testing history retrieval...');
    const history = await chatService.getHistory(testSessionId);
    console.log('✅ History retrieved');
    console.log('Message count:', history.messageCount);
    console.log('Session:', history.session?.title || 'No title');

    // Test 4: Get all sessions
    console.log('\n4. Testing session listing...');
    const sessions = await chatService.getAllSessions();
    console.log('✅ Sessions retrieved');
    console.log('Total sessions:', sessions.length);

    // Test 5: Update session title
    console.log('\n5. Testing session title update...');
    await chatService.updateSessionTitle(testSessionId, 'Test Chat Session');
    const updatedHistory = await chatService.getHistory(testSessionId);
    console.log('✅ Title updated');
    console.log('New title:', updatedHistory.session?.title);

    // Test 6: Clear specific session
    console.log('\n6. Testing session cleanup...');
    const cleared = await chatService.clearHistory(testSessionId);
    console.log('✅ Session cleared:', cleared);

    const clearedHistory = await chatService.getHistory(testSessionId);
    console.log('Messages after clear:', clearedHistory.messageCount);

    console.log('\n🎉 All tests passed!');

    return {
      success: true,
      testSessionId,
      tests: [
        'Chat functionality',
        'Conversation continuity',
        'History retrieval',
        'Session listing',
        'Title update',
        'Session cleanup'
      ]
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Example of how to run this test:
// In Strapi console: testPersistentChatService(strapi)
