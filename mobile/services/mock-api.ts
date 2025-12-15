/**
 * Mock API service for fetching messages
 * This simulates an API call that would fetch messages based on QR code data
 */

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  read: boolean;
}

/**
 * Simulates an API call to fetch messages based on QR code data
 * @param qrData - The data from the scanned QR code
 * @returns Promise<Message[]> - Array of messages
 */
export async function fetchMessages(qrData: string): Promise<Message[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Generate mock messages based on QR data
  const mockMessages: Message[] = [
    {
      id: `msg_${Date.now()}_1`,
      content: `Welcome! You scanned: ${qrData}`,
      sender: 'System',
      timestamp: new Date().toISOString(),
      read: false,
    },
    {
      id: `msg_${Date.now()}_2`,
      content: 'This is a mock message from the API',
      sender: 'Admin',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: false,
    },
    {
      id: `msg_${Date.now()}_3`,
      content: `QR Code Type: ${qrData.length > 10 ? 'Complex' : 'Simple'}`,
      sender: 'Bot',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      read: true,
    },
  ];

  // Randomly add more messages based on QR data length
  const additionalMessageCount = Math.min(qrData.length % 5, 3);
  for (let i = 0; i < additionalMessageCount; i++) {
    mockMessages.push({
      id: `msg_${Date.now()}_${i + 4}`,
      content: `Additional message ${i + 1} for QR: ${qrData.substring(0, 20)}...`,
      sender: `User${i + 1}`,
      timestamp: new Date(Date.now() - (i + 3) * 3600000).toISOString(),
      read: Math.random() > 0.5,
    });
  }

  return mockMessages;
}

/**
 * Simulates fetching a single message by ID
 * @param messageId - The ID of the message to fetch
 * @returns Promise<Message | null>
 */
export async function fetchMessageById(messageId: string): Promise<Message | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    id: messageId,
    content: `This is message with ID: ${messageId}`,
    sender: 'System',
    timestamp: new Date().toISOString(),
    read: false,
  };
}

/**
 * Simulates marking a message as read
 * @param messageId - The ID of the message to mark as read
 * @returns Promise<boolean>
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  console.log(`Message ${messageId} marked as read`);
  return true;
}

