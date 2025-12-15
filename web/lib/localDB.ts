/**
 * IndexedDB utility for local chat storage
 * Stores messages and conversations locally on the device
 */

import type { Message, Conversation } from '@/types';

const DB_NAME = 'EncryptedChatDB';
const DB_VERSION = 2;
const MESSAGES_STORE = 'messages';
const CONVERSATIONS_STORE = 'conversations';
const DECRYPTED_MESSAGES_STORE = 'decryptedMessages';
const IMPORTED_MESSAGES_STORE = 'importedMessages';

interface DecryptedMessage {
  messageId: string;
  content: string;
  timestamp: number;
}

export interface ImportedMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  timestamp: string;
  isImported: boolean;
}

class LocalDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // Create messages store
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: '_id' });
          messagesStore.createIndex('conversationId', 'conversationId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create conversations store
        if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
          const conversationsStore = db.createObjectStore(CONVERSATIONS_STORE, { keyPath: '_id' });
          conversationsStore.createIndex('lastMessageAt', 'lastMessageAt', { unique: false });
        }

        // Create decrypted messages store (for caching)
        if (!db.objectStoreNames.contains(DECRYPTED_MESSAGES_STORE)) {
          const decryptedStore = db.createObjectStore(DECRYPTED_MESSAGES_STORE, { keyPath: 'messageId' });
          decryptedStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Version 2: Add imported messages store
        if (oldVersion < 2 && !db.objectStoreNames.contains(IMPORTED_MESSAGES_STORE)) {
          const importedStore = db.createObjectStore(IMPORTED_MESSAGES_STORE, { keyPath: '_id' });
          importedStore.createIndex('conversationId', 'conversationId', { unique: false });
          importedStore.createIndex('timestamp', 'timestamp', { unique: false });
          importedStore.createIndex('isImported', 'isImported', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // ==================== MESSAGES ====================

  /**
   * Save a message to local storage
   */
  async saveMessage(message: Message): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      const request = store.put(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save message'));
    });
  }

  /**
   * Save multiple messages to local storage
   */
  async saveMessages(messages: Message[]): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);

      let completed = 0;
      let hasError = false;

      messages.forEach((message) => {
        const request = store.put(message);
        request.onsuccess = () => {
          completed++;
          if (completed === messages.length && !hasError) {
            resolve();
          }
        };
        request.onerror = () => {
          hasError = true;
          reject(new Error('Failed to save messages'));
        };
      });

      if (messages.length === 0) {
        resolve();
      }
    });
  }

  /**
   * Get messages for a conversation from local storage
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        const messages = request.result as Message[];
        // Sort by timestamp
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(messages);
      };
      request.onerror = () => reject(new Error('Failed to get messages'));
    });
  }

  /**
   * Delete a message from local storage
   */
  async deleteMessage(messageId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      const request = store.delete(messageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete message'));
    });
  }

  /**
   * Clear all messages for a conversation
   */
  async clearConversationMessages(conversationId: string): Promise<void> {
    const messages = await this.getMessages(conversationId);
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);

      let completed = 0;
      let hasError = false;

      messages.forEach((message) => {
        const request = store.delete(message._id);
        request.onsuccess = () => {
          completed++;
          if (completed === messages.length && !hasError) {
            resolve();
          }
        };
        request.onerror = () => {
          hasError = true;
          reject(new Error('Failed to clear messages'));
        };
      });

      if (messages.length === 0) {
        resolve();
      }
    });
  }

  // ==================== CONVERSATIONS ====================

  /**
   * Save a conversation to local storage
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.put(conversation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save conversation'));
    });
  }

  /**
   * Save multiple conversations to local storage
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);

      let completed = 0;
      let hasError = false;

      conversations.forEach((conversation) => {
        const request = store.put(conversation);
        request.onsuccess = () => {
          completed++;
          if (completed === conversations.length && !hasError) {
            resolve();
          }
        };
        request.onerror = () => {
          hasError = true;
          reject(new Error('Failed to save conversations'));
        };
      });

      if (conversations.length === 0) {
        resolve();
      }
    });
  }

  /**
   * Get all conversations from local storage
   */
  async getConversations(): Promise<Conversation[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE], 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const conversations = request.result as Conversation[];
        // Sort by lastMessageAt
        conversations.sort((a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );
        resolve(conversations);
      };
      request.onerror = () => reject(new Error('Failed to get conversations'));
    });
  }

  /**
   * Get a conversation by ID from local storage
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE], 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.get(conversationId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get conversation'));
    });
  }

  /**
   * Delete a conversation from local storage
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.delete(conversationId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete conversation'));
    });
  }

  // ==================== DECRYPTED MESSAGES CACHE ====================

  /**
   * Save decrypted message content to cache
   */
  async saveDecryptedMessage(messageId: string, content: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DECRYPTED_MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(DECRYPTED_MESSAGES_STORE);
      const decryptedMessage: DecryptedMessage = {
        messageId,
        content,
        timestamp: Date.now(),
      };
      const request = store.put(decryptedMessage);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save decrypted message'));
    });
  }

  /**
   * Get decrypted message content from cache
   */
  async getDecryptedMessage(messageId: string): Promise<string | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DECRYPTED_MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(DECRYPTED_MESSAGES_STORE);
      const request = store.get(messageId);

      request.onsuccess = () => {
        const result = request.result as DecryptedMessage | undefined;
        resolve(result?.content || null);
      };
      request.onerror = () => reject(new Error('Failed to get decrypted message'));
    });
  }

  /**
   * Clear old decrypted messages (older than 7 days)
   */
  async clearOldDecryptedMessages(): Promise<void> {
    const db = await this.ensureDB();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DECRYPTED_MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(DECRYPTED_MESSAGES_STORE);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(sevenDaysAgo);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(new Error('Failed to clear old decrypted messages'));
    });
  }

  // ==================== UTILITY ====================

  /**
   * Clear all data from local storage
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [MESSAGES_STORE, CONVERSATIONS_STORE, DECRYPTED_MESSAGES_STORE, IMPORTED_MESSAGES_STORE],
        'readwrite'
      );

      const messagesStore = transaction.objectStore(MESSAGES_STORE);
      const conversationsStore = transaction.objectStore(CONVERSATIONS_STORE);
      const decryptedStore = transaction.objectStore(DECRYPTED_MESSAGES_STORE);
      const importedStore = transaction.objectStore(IMPORTED_MESSAGES_STORE);

      const clearMessages = messagesStore.clear();
      const clearConversations = conversationsStore.clear();
      const clearDecrypted = decryptedStore.clear();
      const clearImported = importedStore.clear();

      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 4) resolve();
      };

      clearMessages.onsuccess = checkComplete;
      clearConversations.onsuccess = checkComplete;
      clearDecrypted.onsuccess = checkComplete;
      clearImported.onsuccess = checkComplete;

      transaction.onerror = () => reject(new Error('Failed to clear all data'));
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  // ==================== IMPORTED MESSAGES ====================

  /**
   * Save an imported message
   */
  async saveImportedMessage(message: ImportedMessage): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMPORTED_MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMPORTED_MESSAGES_STORE);
      const request = store.put(message);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save imported message'));
    });
  }

  /**
   * Get imported messages for a conversation
   */
  async getImportedMessages(conversationId: string): Promise<ImportedMessage[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMPORTED_MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMPORTED_MESSAGES_STORE);
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get imported messages'));
    });
  }

  /**
   * Get all imported messages
   */
  async getAllImportedMessages(): Promise<ImportedMessage[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMPORTED_MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMPORTED_MESSAGES_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get all imported messages'));
    });
  }

  /**
   * Clear all imported messages
   */
  async clearImportedMessages(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IMPORTED_MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(IMPORTED_MESSAGES_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear imported messages'));
    });
  }
}

export const localDB = new LocalDB();