import { Preferences } from '@capacitor/preferences';

/**
 * Utility functions for NFC data handling and APDU communication
 * These functions handle chunking, assembly, and communication with the Android HCE service
 */
export const nfcUtils = {
  
  // Maximum chunk size (matches Java HCE service MAX_CHUNK_SIZE = 250)
  MAX_CHUNK_SIZE: 250,
  
  // APDU Response codes (matching Java implementation)
  APDU_CODES: {
    SUCCESS: '9000',
    MORE_DATA: '61', // 61XX indicates more data available
    UNKNOWN: '6F00',
    INCORRECT_P1P2: '6A86',
    WRONG_LENGTH: '6700'
  },

  /**
   * Chunks data into smaller pieces for NFC transmission
   * @param data - The data string to chunk
   * @returns Array of data chunks
   */
  chunkData: (data: string): string[] => {
    const chunks: string[] = [];
    const dataBytes = new TextEncoder().encode(data);
    
    for (let i = 0; i < dataBytes.length; i += nfcUtils.MAX_CHUNK_SIZE) {
      const chunk = dataBytes.slice(i, i + nfcUtils.MAX_CHUNK_SIZE);
      const chunkString = new TextDecoder().decode(chunk);
      chunks.push(chunkString);
    }
    
    console.log(`Data chunked into ${chunks.length} pieces`);
    return chunks;
  },

  /**
   * Assembles chunks back into original data
   * @param chunks - Array of data chunks
   * @returns Assembled data string
   */
  assembleChunks: (chunks: string[]): string => {
    const assembledData = chunks.join('');
    console.log(`Assembled ${chunks.length} chunks into ${assembledData.length} characters`);
    return assembledData;
  },

  /**
   * Converts string to hex representation (for APDU communication)
   * @param str - Input string
   * @returns Hex string
   */
  stringToHex: (str: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
      .join('');
  },

  /**
   * Converts hex string back to regular string
   * @param hex - Hex string
   * @returns Regular string
   */
  hexToString: (hex: string): string => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new TextDecoder().decode(bytes);
  },

  /**
   * Creates APDU command string
   * @param cla - Class byte
   * @param ins - Instruction byte
   * @param p1 - Parameter 1
   * @param p2 - Parameter 2
   * @param data - Command data (optional)
   * @param le - Expected response length (optional)
   * @returns APDU command string
   */
  createAPDU: (cla: string, ins: string, p1: string, p2: string, data?: string, le?: string): string => {
    let apdu = cla + ins + p1 + p2;
    
    if (data) {
      const dataLength = (data.length / 2).toString(16).padStart(2, '0').toUpperCase();
      apdu += dataLength + data;
    } else {
      apdu += '00'; // No data
    }
    
    if (le) {
      apdu += le;
    } else {
      apdu += '00'; // Expected response length
    }
    
    return apdu;
  },

  /**
   * Parses APDU response
   * @param response - APDU response string
   * @returns Parsed response object
   */
  parseAPDUResponse: (response: string): { data: string; sw1: string; sw2: string; success: boolean; hasMoreData: boolean } => {
    if (response.length < 4) {
      return {
        data: '',
        sw1: '6F',
        sw2: '00',
        success: false,
        hasMoreData: false
      };
    }
    
    const sw1 = response.slice(-4, -2);
    const sw2 = response.slice(-2);
    const data = response.slice(0, -4);
    
    const success = sw1 === '90' && sw2 === '00';
    const hasMoreData = sw1 === '61';
    
    return {
      data,
      sw1,
      sw2,
      success,
      hasMoreData
    };
  },

  /**
   * Stores data in Capacitor preferences for the HCE service to access
   * The Java HCE service reads this data from SharedPreferences
   * @param data - Data to store
   */
  storeDataForHCE: async (data: string): Promise<void> => {
    try {
      // Store data in the same format that the Java HCE service expects
      const dataObject = {
        value: data,
        timestamp: Date.now(),
        chunks: nfcUtils.chunkData(data).length
      };
      
      await Preferences.set({
        key: 'public_key_data',
        value: JSON.stringify(dataObject)
      });
      
      console.log('Data stored for HCE service:', dataObject);
    } catch (error) {
      console.error('Error storing data for HCE:', error);
      throw error;
    }
  },

  /**
   * Retrieves data from Capacitor preferences
   * @returns Stored data or null
   */
  getStoredData: async (): Promise<string | null> => {
    try {
      const result = await Preferences.get({ key: 'public_key_data' });
      if (result.value) {
        const dataObject = JSON.parse(result.value);
        return dataObject.value || dataObject; // Handle both formats
      }
      return null;
    } catch (error) {
      console.error('Error retrieving stored data:', error);
      return null;
    }
  },

  /**
   * Simulates APDU communication for testing
   * In a real scenario, this would communicate with actual NFC hardware
   * @param command - APDU command
   * @returns Promise with APDU response
   */
  simulateAPDUCommunication: async (command: string): Promise<string> => {
    console.log('Simulating APDU command:', command);
    
    // Simulate communication delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Parse command
    const cla = command.slice(0, 2);
    const ins = command.slice(2, 4);
    const p1 = command.slice(4, 6);
    const p2 = command.slice(6, 8);
    
    // Simulate responses based on command
    switch (ins.toUpperCase()) {
      case 'A4': // SELECT
        return '9000'; // Success
        
      case '47': // GET_PUBLIC_KEY
        // Return some data with "more data available" status
        const testData = nfcUtils.stringToHex('Sample data chunk');
        return testData + '6110'; // Data + more data available (16 bytes)
        
      case 'C0': // GET_RESPONSE
        // Return next chunk
        const nextChunk = nfcUtils.stringToHex(' - additional data');
        return nextChunk + '9000'; // Data + success
        
      default:
        return '6F00'; // Unknown command
    }
  },

  /**
   * Validates data size for NFC transmission
   * @param data - Data to validate
   * @returns Validation result
   */
  validateDataSize: (data: string): { isValid: boolean; size: number; maxSize: number; message: string } => {
    const size = new TextEncoder().encode(data).length;
    const maxSize = 2000; // Based on your requirement
    const isValid = size <= maxSize;
    
    return {
      isValid,
      size,
      maxSize,
      message: isValid 
        ? `Data size is valid (${size} bytes)` 
        : `Data too large (${size} bytes). Maximum allowed: ${maxSize} bytes`
    };
  },

  /**
   * Formats data for display
   * @param data - Raw data
   * @returns Formatted data object
   */
  formatDisplayData: (data: string): { 
    raw: string; 
    formatted: any; 
    size: number; 
    type: 'json' | 'text' 
  } => {
    const size = new TextEncoder().encode(data).length;
    let formatted: any;
    let type: 'json' | 'text' = 'text';
    
    try {
      // Try to parse as JSON
      formatted = JSON.parse(data);
      type = 'json';
    } catch {
      // If not JSON, treat as plain text
      formatted = data;
      type = 'text';
    }
    
    return {
      raw: data,
      formatted,
      size,
      type
    };
  },

  /**
   * Generates test data for development
   * @param size - Approximate size in characters
   * @returns Test data string
   */
  generateTestData: (size: number = 500): string => {
    const testObject = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      type: 'test-data',
      content: 'X'.repeat(Math.max(0, size - 100)), // Adjust for JSON overhead
      metadata: {
        source: 'NFC Test App',
        version: '1.0.0',
        chunks: Math.ceil(size / nfcUtils.MAX_CHUNK_SIZE)
      }
    };
    
    let result = JSON.stringify(testObject, null, 2);
    
    // Trim or pad to approximate requested size
    if (result.length > size) {
      result = result.substring(0, size - 3) + '...';
    }
    
    return result;
  },

  /**
   * Logs NFC transaction details for debugging
   * @param operation - Operation type
   * @param details - Operation details
   */
  logTransaction: (operation: string, details: any): void => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation,
      details
    };
    
    console.log('NFC Transaction:', logEntry);
    
    // In a real app, you might want to store these logs
    // for debugging or analytics purposes
  },

  /**
   * Clears all stored NFC data
   */
  clearAllData: async (): Promise<void> => {
    try {
      await Preferences.remove({ key: 'public_key_data' });
      console.log('All NFC data cleared');
    } catch (error) {
      console.error('Error clearing NFC data:', error);
      throw error;
    }
  }
};

export default nfcUtils;