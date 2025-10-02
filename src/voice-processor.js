import { OpenAI } from 'openai';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';

export class VoiceProcessor {
  constructor(options) {
    this.openai = new OpenAI({
      apiKey: options.openaiKey
    });

    this.whisperModel = options.whisperModel || 'whisper-1';
    this.ttsModel = options.ttsModel || 'tts-1';
    this.ttsVoice = options.ttsVoice || 'nova';

    // Create temp directory for audio files
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async transcribeAudio(audioBuffer) {
    let tempFile = null;

    try {
      // Save buffer to temporary file
      const fileName = `audio_${uuidv4()}.ogg`;
      tempFile = path.join(this.tempDir, fileName);
      fs.writeFileSync(tempFile, audioBuffer);

      // Create form data for OpenAI API
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFile));
      formData.append('model', this.whisperModel);

      // Transcribe with Whisper
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: this.whisperModel,
        language: process.env.AGENT_LANGUAGE || 'en'
      });

      logger.info('Audio transcribed successfully');
      return response.text;

    } catch (error) {
      logger.error('Transcription error:', error);

      // Fallback response
      return 'I received your voice message but had trouble understanding it. Could you please try again or send a text message?';

    } finally {
      // Clean up temporary file
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  async textToSpeech(text) {
    try {
      // Generate speech with OpenAI TTS
      const response = await this.openai.audio.speech.create({
        model: this.ttsModel,
        voice: this.ttsVoice,
        input: text,
        response_format: 'opus' // Best for WhatsApp
      });

      // Get buffer from response
      const buffer = Buffer.from(await response.arrayBuffer());

      logger.info('Speech generated successfully');
      return buffer;

    } catch (error) {
      logger.error('TTS error:', error);
      throw error;
    }
  }

  async convertAudioFormat(inputBuffer, fromFormat, toFormat) {
    const inputFile = path.join(this.tempDir, `input_${uuidv4()}.${fromFormat}`);
    const outputFile = path.join(this.tempDir, `output_${uuidv4()}.${toFormat}`);

    try {
      // Write input buffer to file
      fs.writeFileSync(inputFile, inputBuffer);

      // Import fluent-ffmpeg dynamically
      const ffmpeg = (await import('fluent-ffmpeg')).default;

      return new Promise((resolve, reject) => {
        ffmpeg(inputFile)
          .toFormat(toFormat)
          .on('end', () => {
            const outputBuffer = fs.readFileSync(outputFile);

            // Clean up files
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);

            resolve(outputBuffer);
          })
          .on('error', (err) => {
            // Clean up files
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

            reject(err);
          })
          .save(outputFile);
      });
    } catch (error) {
      // Clean up files on error
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

      throw error;
    }
  }

  cleanTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);

      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        // Delete files older than 1 hour
        const ageInMs = Date.now() - stats.mtimeMs;
        if (ageInMs > 3600000) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      logger.error('Failed to clean temp files:', error);
    }
  }
}