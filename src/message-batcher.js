import { logger } from './utils/logger.js';

/**
 * OPTIMIZATION: Message Batching System
 * Groups multiple incoming messages from same user within time window
 * Reduces API calls and improves context coherence
 */
export class MessageBatcher {
  constructor(options = {}) {
    this.batchWindow = options.batchWindow || 2000; // 2 second window
    this.maxBatchSize = options.maxBatchSize || 5; // Max messages per batch
    this.batches = new Map(); // user -> { messages: [], timer: setTimeout }
    this.processCallback = options.processCallback;
  }

  /**
   * Add message to batch queue
   * @param {string} userId - User identifier
   * @param {object} message - Message data
   */
  addMessage(userId, message) {
    if (!this.batches.has(userId)) {
      // Create new batch
      this.batches.set(userId, {
        messages: [],
        timer: null
      });
    }

    const batch = this.batches.get(userId);
    batch.messages.push(message);

    // Clear existing timer
    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    // Check if batch is full
    if (batch.messages.length >= this.maxBatchSize) {
      this.processBatch(userId);
    } else {
      // Set new timer
      batch.timer = setTimeout(() => {
        this.processBatch(userId);
      }, this.batchWindow);
    }
  }

  /**
   * Process accumulated messages for user
   */
  async processBatch(userId) {
    const batch = this.batches.get(userId);
    if (!batch || batch.messages.length === 0) return;

    const messages = batch.messages;
    this.batches.delete(userId);

    logger.info(`Processing batch of ${messages.length} messages for ${userId}`);

    if (this.processCallback) {
      try {
        // Combine messages if multiple
        if (messages.length === 1) {
          await this.processCallback(userId, messages[0]);
        } else {
          // OPTIMIZATION: Combine multiple messages into single context
          const combinedMessage = this.combineMessages(messages);
          await this.processCallback(userId, combinedMessage);
        }
      } catch (error) {
        logger.error('Batch processing error:', error);
      }
    }
  }

  /**
   * Combine multiple messages into single message with context
   */
  combineMessages(messages) {
    const textMessages = messages
      .map((msg, idx) => {
        const content = this.extractContent(msg);
        return messages.length > 1 ? `${idx + 1}. ${content}` : content;
      })
      .join('\n');

    return {
      ...messages[0], // Use first message as base
      message: {
        conversation: textMessages
      },
      _batchSize: messages.length
    };
  }

  /**
   * Extract text content from message
   */
  extractContent(message) {
    const messageObj = message.message || {};

    if (messageObj.conversation) {
      return messageObj.conversation;
    }

    if (messageObj.extendedTextMessage?.text) {
      return messageObj.extendedTextMessage.text;
    }

    if (messageObj.audioMessage) {
      return '[Voice message]';
    }

    if (messageObj.imageMessage) {
      return messageObj.imageMessage.caption || '[Image]';
    }

    return '[Message]';
  }

  /**
   * Force process all pending batches
   */
  async flushAll() {
    const userIds = Array.from(this.batches.keys());

    for (const userId of userIds) {
      await this.processBatch(userId);
    }
  }

  /**
   * Get batch statistics
   */
  getStats() {
    return {
      activeBatches: this.batches.size,
      totalPendingMessages: Array.from(this.batches.values())
        .reduce((sum, batch) => sum + batch.messages.length, 0)
    };
  }

  /**
   * Clear batch for specific user
   */
  clearBatch(userId) {
    const batch = this.batches.get(userId);
    if (batch && batch.timer) {
      clearTimeout(batch.timer);
    }
    this.batches.delete(userId);
  }

  /**
   * Cleanup - clear all batches
   */
  destroy() {
    for (const batch of this.batches.values()) {
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
    }
    this.batches.clear();
  }
}
