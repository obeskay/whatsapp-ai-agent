import dotenv from 'dotenv';
import chalk from 'chalk';
import { OpenAI } from 'openai';

dotenv.config();

console.log(chalk.cyan('\n🧪 WhatsApp AI Agent Test Suite\n'));

async function testOpenAI() {
  console.log(chalk.yellow('Testing OpenAI/OpenRouter connection...'));

  try {
    let ai;
    let model;

    if (process.env.USE_OPENROUTER === 'true') {
      console.log(chalk.blue('Using OpenRouter'));
      ai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/obedvargasvillarreal/whatsapp-ai-agent',
          'X-Title': 'WhatsApp AI Agent'
        }
      });
      model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-small-3';
    } else {
      console.log(chalk.blue('Using OpenAI'));
      ai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      model = process.env.OPENAI_MODEL || 'gpt-5-mini';
    }

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a test assistant.' },
        { role: 'user', content: 'Reply with exactly: "Test successful!"' }
      ],
      max_tokens: 10
    });

    const response = completion.choices[0]?.message?.content;
    if (response && response.includes('successful')) {
      console.log(chalk.green('✅ AI connection: Success'));
      console.log(chalk.gray(`   Response: ${response}`));
      return true;
    } else {
      console.log(chalk.red('❌ AI connection: Unexpected response'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red('❌ AI connection: Failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    return false;
  }
}

async function testEvolutionAPI() {
  console.log(chalk.yellow('\nTesting Evolution API connection...'));

  try {
    const { EvolutionAPI } = await import('./evolution-api.js');

    const api = new EvolutionAPI({
      apiUrl: process.env.EVOLUTION_API_URL,
      apiKey: process.env.EVOLUTION_API_KEY,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME
    });

    const instances = await api.getInstances();
    console.log(chalk.green('✅ Evolution API: Connected'));
    console.log(chalk.gray(`   Found ${instances.length} instance(s)`));

    // Check if our instance exists
    const ourInstance = instances.find(i => i.instanceName === process.env.EVOLUTION_INSTANCE_NAME);
    if (ourInstance) {
      console.log(chalk.blue(`   Instance '${process.env.EVOLUTION_INSTANCE_NAME}' exists`));

      // Check connection status
      const status = await api.getConnectionStatus();
      console.log(chalk.gray(`   Connection state: ${status.state}`));
    } else {
      console.log(chalk.yellow(`   Instance '${process.env.EVOLUTION_INSTANCE_NAME}' not found (will be created on start)`));
    }

    return true;
  } catch (error) {
    console.log(chalk.red('❌ Evolution API: Failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    console.log(chalk.yellow('\n   Make sure Evolution API is running:'));
    console.log(chalk.gray('   docker run -d --name evolution-api -p 8080:8080 evolutionapi/evolution-api:latest'));
    return false;
  }
}

async function testVoiceProcessing() {
  console.log(chalk.yellow('\nTesting voice processing capabilities...'));

  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.yellow('⚠️  Voice processing requires OpenAI API key'));
    console.log(chalk.gray('   OpenRouter does not support Whisper/TTS yet'));
    return false;
  }

  try {
    const { VoiceProcessor } = await import('./voice-processor.js');

    const processor = new VoiceProcessor({
      openaiKey: process.env.OPENAI_API_KEY,
      whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
      ttsModel: process.env.TTS_MODEL || 'tts-1',
      ttsVoice: process.env.TTS_VOICE || 'nova'
    });

    // Test TTS
    console.log(chalk.blue('   Testing Text-to-Speech...'));
    const audioBuffer = await processor.textToSpeech('Hello, this is a test.');

    if (audioBuffer && audioBuffer.length > 0) {
      console.log(chalk.green('✅ Voice processing: TTS working'));
      console.log(chalk.gray(`   Generated audio: ${audioBuffer.length} bytes`));
      return true;
    } else {
      console.log(chalk.red('❌ Voice processing: TTS failed'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red('❌ Voice processing: Failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log(chalk.yellow('\nTesting webhook endpoint...'));

  try {
    const port = process.env.PORT || 3003;
    const response = await fetch(`http://localhost:${port}/health`).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      console.log(chalk.green('✅ Webhook endpoint: Active'));
      console.log(chalk.gray(`   Status: ${data.status}`));
      return true;
    } else {
      console.log(chalk.yellow('⚠️  Webhook endpoint: Not running'));
      console.log(chalk.gray('   Start the agent first with: npm start'));
      return false;
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Webhook endpoint: Not accessible'));
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    ai: await testOpenAI(),
    evolution: await testEvolutionAPI(),
    voice: await testVoiceProcessing(),
    webhook: await testWebhookEndpoint()
  };

  // Summary
  console.log(chalk.cyan('\n═══════════════════════════════════════'));
  console.log(chalk.cyan('Test Summary:'));

  const passedTests = Object.values(results).filter(r => r).length;
  const totalTests = Object.values(results).length;

  if (passedTests === totalTests) {
    console.log(chalk.green(`\n✅ All tests passed! (${passedTests}/${totalTests})`));
    console.log(chalk.cyan('\nYour WhatsApp AI Agent is ready to use!'));
    console.log(chalk.white('Run: npm start'));
  } else if (passedTests > 0) {
    console.log(chalk.yellow(`\n⚠️  Some tests passed (${passedTests}/${totalTests})`));
    console.log(chalk.yellow('\nThe agent may work with limited functionality.'));
  } else {
    console.log(chalk.red(`\n❌ All tests failed (${passedTests}/${totalTests})`));
    console.log(chalk.red('\nPlease check your configuration and try again.'));
  }

  console.log(chalk.cyan('═══════════════════════════════════════\n'));
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch(error => {
  console.error(chalk.red('Test suite failed:'), error);
  process.exit(1);
});