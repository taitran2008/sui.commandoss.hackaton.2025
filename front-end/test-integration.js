#!/usr/bin/env node

/**
 * Simple integration test script to verify TaskAPI integration with SUI blockchain
 */

const { taskAPI } = require('./src/lib/taskAPI.ts');

async function testIntegration() {
  console.log('🧪 Testing TaskAPI integration...');
  
  // Test 1: Create mock task (without wallet)
  console.log('\n📝 Test 1: Creating mock task...');
  try {
    const mockTask = await taskAPI.createTask({
      task: 'test-translation',
      description: 'Test translation task from integration test',
      category: 'translation',
      urgency: 'standard',
      estimated_duration: '30 minutes',
      reward_amount: '0.1 SUI'
    });
    
    console.log('✅ Mock task created successfully:', {
      uuid: mockTask.uuid,
      task: mockTask.task,
      submitter: mockTask.submitter
    });
  } catch (error) {
    console.error('❌ Mock task creation failed:', error.message);
  }
  
  // Test 2: Try to create SUI task without wallet (should fallback to mock)
  console.log('\n🔗 Test 2: Creating task with empty wallet info...');
  try {
    const fallbackTask = await taskAPI.createTask({
      task: 'test-data-entry',
      description: 'Test data entry task with fallback',
      category: 'data-entry',
      urgency: 'high',
      estimated_duration: '1 hour',
      reward_amount: '0.2 SUI'
    }, undefined); // No wallet info
    
    console.log('✅ Fallback task created successfully:', {
      uuid: fallbackTask.uuid,
      task: fallbackTask.task,
      submitter: fallbackTask.submitter
    });
  } catch (error) {
    console.error('❌ Fallback task creation failed:', error.message);
  }
  
  console.log('\n🎉 Integration test completed!');
  console.log('💡 To test blockchain integration, connect a wallet in the web UI.');
}

// Run the test
testIntegration().catch(console.error);
