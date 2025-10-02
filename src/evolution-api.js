import axios from 'axios';
import FormData from 'form-data';
import { logger } from './utils/logger.js';

export class EvolutionAPI {
  constructor(options) {
    this.apiUrl = options.apiUrl;
    this.apiKey = options.apiKey;
    this.instanceName = options.instanceName;
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async initialize() {
    try {
      // Check if instance exists
      const instances = await this.getInstances();
      const existingInstance = instances.find(i => i.instanceName === this.instanceName);

      if (!existingInstance) {
        // Create new instance
        logger.info(`Creating new instance: ${this.instanceName}`);
        await this.createInstance();
      } else {
        logger.info(`Using existing instance: ${this.instanceName}`);

        // Check connection status
        const status = await this.getConnectionStatus();
        if (status.state === 'close') {
          // Restart instance
          await this.restartInstance();
        }
      }

      return true;
    } catch (error) {
      logger.error('Evolution API initialization error:', error);
      throw error;
    }
  }

  async getInstances() {
    try {
      const response = await this.client.get('/instance/list');
      return response.data || [];
    } catch (error) {
      logger.error('Failed to get instances:', error);
      return [];
    }
  }

  async createInstance() {
    try {
      const response = await this.client.post('/instance/create', {
        instanceName: this.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });

      logger.info('Instance created successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to create instance:', error);
      throw error;
    }
  }

  async getConnectionStatus() {
    try {
      const response = await this.client.get(`/instance/connectionState/${this.instanceName}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get connection status:', error);
      return { state: 'unknown' };
    }
  }

  async restartInstance() {
    try {
      logger.info('Restarting instance...');
      await this.client.put(`/instance/restart/${this.instanceName}`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for restart
      return true;
    } catch (error) {
      logger.error('Failed to restart instance:', error);
      throw error;
    }
  }

  async getQRCode() {
    try {
      const response = await this.client.get(`/instance/qrcode/${this.instanceName}`);

      if (response.data?.qrcode) {
        return response.data.qrcode;
      }

      // Try alternative endpoint
      const altResponse = await this.client.get(`/instance/qr/${this.instanceName}`);
      return altResponse.data?.qr || null;
    } catch (error) {
      logger.error('Failed to get QR code:', error);
      return null;
    }
  }

  async setWebhook(webhookUrl) {
    try {
      const response = await this.client.post(`/webhook/set/${this.instanceName}`, {
        webhook: {
          url: webhookUrl,
          events: [
            'messages.upsert',
            'connection.update',
            'qr'
          ]
        }
      });

      logger.info('Webhook configured successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to set webhook:', error);
      throw error;
    }
  }

  async sendMessage(to, message) {
    try {
      let endpoint, payload;

      if (message.type === 'text') {
        endpoint = `/message/sendText/${this.instanceName}`;
        payload = {
          number: to,
          text: message.content
        };
      } else if (message.type === 'audio') {
        endpoint = `/message/sendAudio/${this.instanceName}`;

        // Convert audio buffer to base64
        const audioBase64 = message.content.toString('base64');

        payload = {
          number: to,
          audio: `data:audio/ogg;base64,${audioBase64}`,
          caption: message.text || ''
        };
      } else {
        throw new Error(`Unsupported message type: ${message.type}`);
      }

      const response = await this.client.post(endpoint, payload);

      logger.info(`Message sent to ${to}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async downloadMedia(message) {
    try {
      if (!message.message?.audioMessage) {
        throw new Error('No audio message found');
      }

      const mediaKey = message.message.audioMessage.mediaKey;
      const directPath = message.message.audioMessage.directPath;
      const url = message.message.audioMessage.url;

      // Try to get media from Evolution API
      const response = await this.client.post(`/message/getMedia/${this.instanceName}`, {
        message: {
          key: message.key,
          messageType: 'audioMessage'
        }
      });

      if (response.data?.media) {
        // Convert base64 to buffer
        const base64Data = response.data.media.replace(/^data:audio\/\w+;base64,/, '');
        return Buffer.from(base64Data, 'base64');
      }

      // Fallback: try direct download if URL is available
      if (url) {
        const mediaResponse = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(mediaResponse.data);
      }

      throw new Error('Unable to download media');
    } catch (error) {
      logger.error('Failed to download media:', error);
      throw error;
    }
  }

  async sendPresence(to, type = 'available') {
    try {
      await this.client.post(`/chat/presence/${this.instanceName}`, {
        number: to,
        presence: type
      });
    } catch (error) {
      logger.error('Failed to send presence:', error);
    }
  }

  async markAsRead(messageId) {
    try {
      await this.client.post(`/chat/markMessageAsRead/${this.instanceName}`, {
        messageId
      });
    } catch (error) {
      logger.error('Failed to mark as read:', error);
    }
  }

  async setTyping(remoteJid, isTyping) {
    try {
      await this.client.post(`/chat/presence/${this.instanceName}`, {
        number: remoteJid,
        presence: isTyping ? 'composing' : 'available'
      });
    } catch (error) {
      // Non-critical, don't log
    }
  }

  async disconnect() {
    try {
      await this.client.delete(`/instance/logout/${this.instanceName}`);
      logger.info('Instance disconnected');
    } catch (error) {
      logger.error('Failed to disconnect:', error);
    }
  }

  async deleteInstance() {
    try {
      await this.client.delete(`/instance/delete/${this.instanceName}`);
      logger.info('Instance deleted');
    } catch (error) {
      logger.error('Failed to delete instance:', error);
    }
  }
}