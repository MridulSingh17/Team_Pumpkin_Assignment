import AsyncStorage from '@react-native-async-storage/async-storage';

const QR_DATA_KEY = 'qr_scan_history';

export interface QRData {
  type: string;
  data: string;
  timestamp: string;
}

/**
 * Save QR code data to local storage
 */
export async function saveQRData(qrData: QRData): Promise<void> {
  try {
    // Get existing history
    const existingData = await AsyncStorage.getItem(QR_DATA_KEY);
    const history: QRData[] = existingData ? JSON.parse(existingData) : [];
    
    // Add new data to the beginning of the array
    history.unshift(qrData);
    
    // Keep only the last 50 scans
    const trimmedHistory = history.slice(0, 50);
    
    // Save back to storage
    await AsyncStorage.setItem(QR_DATA_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Error saving QR data:', error);
    throw error;
  }
}

/**
 * Get all QR scan history from local storage
 */
export async function getQRDataHistory(): Promise<QRData[]> {
  try {
    const data = await AsyncStorage.getItem(QR_DATA_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting QR data history:', error);
    return [];
  }
}

/**
 * Clear all QR scan history
 */
export async function clearQRDataHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QR_DATA_KEY);
  } catch (error) {
    console.error('Error clearing QR data history:', error);
    throw error;
  }
}

/**
 * Get a specific QR data entry by index
 */
export async function getQRDataByIndex(index: number): Promise<QRData | null> {
  try {
    const history = await getQRDataHistory();
    return history[index] || null;
  } catch (error) {
    console.error('Error getting QR data by index:', error);
    return null;
  }
}

