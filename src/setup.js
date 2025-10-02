import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

console.log(chalk.cyan('\n🔧 WhatsApp AI Agent Setup\n'));

// Check environment variables
const requiredEnvVars = [
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE_NAME'
];

const optionalEnvVars = [
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY'
];

let hasErrors = false;

console.log(chalk.yellow('Checking required environment variables...'));
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(chalk.green(`✅ ${varName}: Set`));
  } else {
    console.log(chalk.red(`❌ ${varName}: Missing`));
    hasErrors = true;
  }
});

console.log(chalk.yellow('\nChecking AI provider configuration...'));
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

if (hasOpenAI) {
  console.log(chalk.green('✅ OpenAI API key: Set'));
} else if (hasOpenRouter) {
  console.log(chalk.green('✅ OpenRouter API key: Set'));
  console.log(chalk.blue('   Using OpenRouter for AI models'));
} else {
  console.log(chalk.red('❌ No AI provider configured'));
  console.log(chalk.yellow('   Please set either OPENAI_API_KEY or OPENROUTER_API_KEY'));
  hasErrors = true;
}

// Check Evolution API connectivity
console.log(chalk.yellow('\nChecking Evolution API connection...'));
import('./evolution-api.js').then(async ({ EvolutionAPI }) => {
  try {
    const api = new EvolutionAPI({
      apiUrl: process.env.EVOLUTION_API_URL,
      apiKey: process.env.EVOLUTION_API_KEY,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME
    });

    const instances = await api.getInstances();
    console.log(chalk.green(`✅ Evolution API: Connected (${instances.length} instances found)`));
  } catch (error) {
    console.log(chalk.red('❌ Evolution API: Connection failed'));
    console.log(chalk.yellow(`   Error: ${error.message}`));
    console.log(chalk.blue('\n   Make sure Evolution API is running:'));
    console.log(chalk.gray('   docker run -d --name evolution-api -p 8080:8080 evolutionapi/evolution-api:latest'));
    hasErrors = true;
  }

  // Create necessary directories
  console.log(chalk.yellow('\nSetting up directories...'));
  const directories = [
    'temp',
    'logs',
    'config'
  ];

  directories.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(chalk.green(`✅ Created ${dir}/ directory`));
    } else {
      console.log(chalk.blue(`✓ ${dir}/ directory exists`));
    }
  });

  // Create default configuration files
  console.log(chalk.yellow('\nCreating configuration files...'));

  // Personalities config
  const personalitiesPath = path.join(process.cwd(), 'config', 'personalities.json');
  if (!fs.existsSync(personalitiesPath)) {
    const personalities = {
      assistant: {
        name: 'Professional Assistant',
        prompt: 'You are a helpful professional assistant. Be concise, accurate, and polite.',
        voice: 'nova',
        language: 'en'
      },
      friendly: {
        name: 'Friendly Buddy',
        prompt: 'You are a casual, friendly chat companion. Be warm, engaging, and supportive.',
        voice: 'onyx',
        language: 'en'
      },
      technical: {
        name: 'Tech Support',
        prompt: 'You are a technical support specialist. Be clear, detailed, and solution-oriented.',
        voice: 'echo',
        language: 'en'
      }
    };
    fs.writeFileSync(personalitiesPath, JSON.stringify(personalities, null, 2));
    console.log(chalk.green('✅ Created personalities.json'));
  }

  // Filters config
  const filtersPath = path.join(process.cwd(), 'config', 'filters.json');
  if (!fs.existsSync(filtersPath)) {
    const filters = {
      blocked_keywords: [],
      auto_responses: {
        '/help': 'Available commands:\\n/help - Show this message\\n/voice - Toggle voice responses\\n/personality - Change agent personality',
        '/start': 'Hello! I\\'m your AI assistant. How can I help you today?'
      },
      rate_limits: {
        max_messages_per_minute: 20,
        max_voice_per_minute: 5
      }
    };
    fs.writeFileSync(filtersPath, JSON.stringify(filters, null, 2));
    console.log(chalk.green('✅ Created filters.json'));
  }

  // Summary
  console.log(chalk.cyan('\n═══════════════════════════════════════'));
  if (hasErrors) {
    console.log(chalk.red('\n⚠️  Setup incomplete. Please fix the issues above.'));
    console.log(chalk.yellow('\n1. Copy .env.example to .env'));
    console.log(chalk.yellow('2. Add your API keys'));
    console.log(chalk.yellow('3. Ensure Evolution API is running'));
    console.log(chalk.yellow('4. Run setup again: npm run setup'));
  } else {
    console.log(chalk.green('\n✅ Setup complete!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.white('1. Start the agent: npm start'));
    console.log(chalk.white('2. Scan the QR code with WhatsApp'));
    console.log(chalk.white('3. Send a message to test'));
    console.log(chalk.white('\nDashboard will be available at: http://localhost:3004/dashboard'));
  }
  console.log(chalk.cyan('═══════════════════════════════════════\n'));

  process.exit(hasErrors ? 1 : 0);
}).catch(error => {
  console.error(chalk.red('Setup failed:'), error);
  process.exit(1);
});