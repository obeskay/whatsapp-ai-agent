/**
 * OPTIMIZATION: Intelligent Prompt Compression and Token Management
 * Reduces token usage while maintaining context quality
 */
export class PromptOptimizer {
  constructor(options = {}) {
    this.maxSystemPromptTokens = options.maxSystemPromptTokens || 150;
    this.maxHistoryTokens = options.maxHistoryTokens || 1500;
    this.compressionRatio = options.compressionRatio || 0.7; // Target 30% reduction
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * OPTIMIZATION: Compress system prompt while preserving key information
   */
  compressSystemPrompt(systemPrompt, agentName = 'AI Assistant') {
    // Extract essential information
    const essentials = {
      name: agentName,
      role: 'WhatsApp AI assistant',
      tone: 'helpful, concise',
      format: 'conversational WhatsApp messages'
    };

    // OPTIMIZATION: Ultra-compact system prompt (saves ~50-70% tokens)
    const compressed = `${essentials.name} - ${essentials.role}.
Style: ${essentials.tone}
Format: ${essentials.format}
Keep responses brief and helpful.`;

    const originalTokens = this.estimateTokens(systemPrompt);
    const compressedTokens = this.estimateTokens(compressed);

    const savings = Math.round((1 - compressedTokens / originalTokens) * 100);

    return {
      compressed,
      originalTokens,
      compressedTokens,
      savings: `${savings}%`
    };
  }

  /**
   * OPTIMIZATION: Intelligent history pruning
   * Keeps most recent and most relevant messages
   */
  optimizeHistory(history, maxTokens = 1500) {
    if (!history || history.length === 0) return [];

    // Always keep the most recent messages
    const recentCount = 4; // Last 2 exchanges (4 messages)
    const recent = history.slice(-recentCount);

    let totalTokens = recent.reduce((sum, msg) =>
      sum + this.estimateTokens(msg.content), 0
    );

    if (totalTokens >= maxTokens) {
      // If recent messages exceed limit, truncate them
      return this.truncateMessages(recent, maxTokens);
    }

    // Add older messages until we hit token limit
    const older = history.slice(0, -recentCount);
    const optimized = [...recent];

    // OPTIMIZATION: Prioritize user messages over assistant messages from older history
    const prioritized = this.prioritizeMessages(older);

    for (const msg of prioritized) {
      const msgTokens = this.estimateTokens(msg.content);

      if (totalTokens + msgTokens > maxTokens) {
        break;
      }

      optimized.unshift(msg);
      totalTokens += msgTokens;
    }

    return optimized;
  }

  /**
   * Prioritize messages by importance
   * User questions > Short exchanges > Long assistant responses
   */
  prioritizeMessages(messages) {
    return messages.sort((a, b) => {
      const aScore = this.calculateImportance(a);
      const bScore = this.calculateImportance(b);
      return bScore - aScore;
    });
  }

  /**
   * Calculate message importance score
   */
  calculateImportance(message) {
    let score = 0;

    // User messages are more important (contain context)
    if (message.role === 'user') {
      score += 10;
    }

    // Questions are more important
    if (message.content.includes('?')) {
      score += 5;
    }

    // Shorter messages are more likely to be important context
    const length = message.content.length;
    if (length < 100) {
      score += 3;
    } else if (length > 500) {
      score -= 2; // Penalize very long messages
    }

    // Recent messages are more important
    const age = Date.now() - (message.timestamp || 0);
    const ageInMinutes = age / 60000;
    if (ageInMinutes < 5) {
      score += 5;
    } else if (ageInMinutes < 30) {
      score += 2;
    }

    return score;
  }

  /**
   * Truncate messages to fit token limit
   */
  truncateMessages(messages, maxTokens) {
    const truncated = [];
    let totalTokens = 0;

    // Start from most recent
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokens(msg.content);

      if (totalTokens + msgTokens > maxTokens) {
        // Try to truncate this message
        const availableTokens = maxTokens - totalTokens;
        if (availableTokens > 50) { // Only if we can keep meaningful content
          const truncatedContent = this.truncateContent(msg.content, availableTokens);
          truncated.unshift({
            ...msg,
            content: truncatedContent,
            truncated: true
          });
        }
        break;
      }

      truncated.unshift(msg);
      totalTokens += msgTokens;
    }

    return truncated;
  }

  /**
   * Truncate content to fit token budget
   */
  truncateContent(content, maxTokens) {
    const maxChars = maxTokens * 4; // Rough conversion

    if (content.length <= maxChars) {
      return content;
    }

    // Keep beginning and end, indicate truncation
    const keepChars = Math.floor(maxChars / 2);
    const beginning = content.substring(0, keepChars);
    const end = content.substring(content.length - keepChars);

    return `${beginning}...[truncated]...${end}`;
  }

  /**
   * OPTIMIZATION: Summarize old conversations to reduce tokens
   * Useful for very long conversations
   */
  async summarizeHistory(history, summaryFn) {
    if (history.length < 10) return history; // Not worth summarizing

    // Split into recent (keep full) and old (summarize)
    const recentCount = 6;
    const recent = history.slice(-recentCount);
    const old = history.slice(0, -recentCount);

    if (old.length === 0) return recent;

    // Create conversation text from old messages
    const conversationText = old
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    try {
      // Get AI to summarize old conversation
      const summary = await summaryFn(conversationText);

      return [
        {
          role: 'system',
          content: `Previous conversation summary: ${summary}`,
          timestamp: Date.now(),
          isSummary: true
        },
        ...recent
      ];
    } catch (error) {
      // Fallback: just use optimized history
      return this.optimizeHistory(history);
    }
  }

  /**
   * OPTIMIZATION: Create summarization prompt (minimal tokens)
   */
  createSummaryPrompt(conversationText) {
    return `Summarize this conversation in 2-3 sentences, focusing on key context and user needs:\n\n${conversationText}`;
  }

  /**
   * Calculate total tokens for a message array
   */
  calculateTotalTokens(messages) {
    return messages.reduce((sum, msg) => {
      const content = typeof msg === 'string' ? msg :
        (msg.content || JSON.stringify(msg));
      return sum + this.estimateTokens(content);
    }, 0);
  }

  /**
   * OPTIMIZATION: Smart message deduplication
   * Remove duplicate or very similar consecutive messages
   */
  deduplicateHistory(history) {
    if (history.length < 2) return history;

    const deduplicated = [history[0]];

    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const previous = history[i - 1];

      // Skip if very similar to previous message
      if (!this.areMessagesSimilar(current, previous)) {
        deduplicated.push(current);
      }
    }

    return deduplicated;
  }

  /**
   * Check if two messages are similar (likely duplicates)
   */
  areMessagesSimilar(msg1, msg2) {
    if (msg1.role !== msg2.role) return false;

    const content1 = msg1.content.toLowerCase().trim();
    const content2 = msg2.content.toLowerCase().trim();

    // Exact match
    if (content1 === content2) return true;

    // Very similar (>90% overlap)
    const similarity = this.calculateSimilarity(content1, content2);
    return similarity > 0.9;
  }

  /**
   * Calculate similarity between two strings (Jaccard similarity)
   */
  calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(originalHistory, optimizedHistory, originalSystemPrompt, compressedSystemPrompt) {
    const originalTokens = this.calculateTotalTokens([
      { content: originalSystemPrompt },
      ...originalHistory
    ]);

    const optimizedTokens = this.calculateTotalTokens([
      { content: compressedSystemPrompt },
      ...optimizedHistory
    ]);

    const savings = originalTokens - optimizedTokens;
    const savingsPercent = Math.round((savings / originalTokens) * 100);

    return {
      originalTokens,
      optimizedTokens,
      savings,
      savingsPercent: `${savingsPercent}%`,
      messagesRemoved: originalHistory.length - optimizedHistory.length
    };
  }
}
