// Interface for WebAuthn data structure
interface WebAuthnData {
    publicKey: {
      challenge: string;
      timeout: number;
      rpId: string;
      allowCredentials: Array<{
        type: string;
        id: string;
      }>;
      userVerification: string;
    };
  }
  
  // Ultra-compressed encoder/decoder for WebAuthn data
  class UltraCompressor {
    /**
     * Converts a URL-safe base64 string to a Uint8Array of raw bytes.
     * Handles URL-safe characters ('-' for '+', '_' for '/') and removes padding.
     * @param base64 The URL-safe base64 string.
     * @returns A Uint8Array containing the decoded bytes.
     */
    private static base64ToBytes(base64: string): Uint8Array {
      // Replace URL-safe characters back to standard base64 and decode
      const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  
    /**
     * Converts a Uint8Array of bytes back to a URL-safe base64 string.
     * Replaces standard base64 characters ('+', '/', '=') with URL-safe equivalents.
     * @param bytes The Uint8Array of bytes.
     * @returns A URL-safe base64 string.
     */
    private static bytesToBase64(bytes: Uint8Array): string {
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      // Convert to standard base64 then to URL-safe base64, remove padding
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
  
    /**
     * Encodes WebAuthnData into a compressed binary format (Base64 string)
     * and provides compression statistics.
     *
     * The encoding format is as follows:
     * - Challenge: 32 bytes (raw bytes after base64 decoding). Assumed to be fixed length.
     * - Timeout: 3 bytes (Uint24), supporting values up to 16,777,215 milliseconds.
     * - RpId: 1 byte for length (max 255 chars) + variable bytes for UTF-8 encoded string.
     * - Flags: 1 byte. Bit 7 indicates `userVerification` ('required' or 'preferred').
     * Bits 0-6 store the count of `allowCredentials` (max 127 credentials).
     * - Credentials: For each credential in `allowCredentials`:
     * 1 byte for ID length (max 255 bytes) + variable bytes for raw credential ID (after base64 decoding).
     * `type` is assumed to be 'public-key' and not stored.
     *
     * @param data The WebAuthnData object to encode.
     * @returns An object containing the encoded Base64 string and compression statistics.
     */
    static encode(data: WebAuthnData): { encoded: string; stats: { originalJsonLength: number; binaryCompressedLength: number; base64EncodedLength: number; compressionRatio: number; }; } {
      // A temporary buffer, generously sized, which will be trimmed down later.
      const buffer = new ArrayBuffer(2048);
      const view = new DataView(buffer);
      let offset = 0; // Current write position in the buffer
  
      // 1. Challenge (fixed 32 bytes)
      const challengeBytes = this.base64ToBytes(data.publicKey.challenge);
      // if (challengeBytes.length !== 32) {
      //   // Log an error if the challenge length is unexpected.
      //   // The encoder will still attempt to write 32 bytes.
      //   console.error("Challenge is not 32 bytes after decoding. Encoding might be off.");
      // }
      for (let i = 0; i < challengeBytes.length; i++) {
        view.setUint8(offset++, challengeBytes[i]);
      }
  
      // 2. Timeout (3 bytes - Uint24)
      // Stores timeout value (up to 16,777,215) across three bytes.
      view.setUint8(offset++, (data.publicKey.timeout >> 16) & 0xFF); // Most significant byte
      view.setUint8(offset++, (data.publicKey.timeout >> 8) & 0xFF);  // Middle byte
      view.setUint8(offset++, data.publicKey.timeout & 0xFF);         // Least significant byte
  
      // 3. RpId length (1 byte) and data (variable bytes)
      const rpIdBytes = new TextEncoder().encode(data.publicKey.rpId);
      // if (rpIdBytes.length > 255) {
      //   console.error("RP ID too long to fit in 1-byte length field. Data might be truncated or invalid.");
      //   // In a real application, you might throw an error or handle truncation.
      //   // For this example, we'll proceed, but it's a potential overflow.
      // }
      view.setUint8(offset++, rpIdBytes.length); // Store length of RpId
      for (let i = 0; i < rpIdBytes.length; i++) {
        view.setUint8(offset++, rpIdBytes[i]); // Store UTF-8 encoded RpId bytes
      }
  
      // 4. Flags byte: User Verification (bit 7) and Credential Count (bits 0-6)
      let flags = data.publicKey.userVerification === 'required' ? 0x80 : 0x00; // Set bit 7 if 'required'
      const credCount = data.publicKey.allowCredentials.length;
      // if (credCount > 127) {
      //   console.error("More than 127 credentials. Not all will be encoded in the 7-bit field.");
      //   // Similar to RpId, handle potential overflow if more than 127 credentials.
      // }
      flags |= (credCount & 0x7F); // Mask to ensure only lower 7 bits are used for count
      view.setUint8(offset++, flags);
  
      // 5. Credentials (variable length for each)
      for (const cred of data.publicKey.allowCredentials) {
        const idBytes = this.base64ToBytes(cred.id);
        // if (idBytes.length > 255) {
        //   console.error("Credential ID too long to fit in 1-byte length field. Data might be truncated or invalid.");
        // }
        view.setUint8(offset++, idBytes.length); // Store length of current credential ID
        for (let i = 0; i < idBytes.length; i++) {
          view.setUint8(offset++, idBytes[i]); // Store raw bytes of credential ID
        }
      }
  
      // Create the final compressed Uint8Array by taking a slice of the buffer
      // up to the current offset, effectively trimming any unused buffer space.
      const compressed = new Uint8Array(buffer, 0, offset);
  
      // Convert the raw bytes to a URL-safe base64 string for transmission.
      const encoded = this.bytesToBase64(compressed);
  
      // Calculate and return compression statistics.
      const originalJsonLength = JSON.stringify(data).length;
      const binaryCompressedLength = compressed.length;
      const base64EncodedLength = encoded.length;
      const compressionRatio = Math.round((1 - base64EncodedLength / originalJsonLength) * 100);
  
      return {
        encoded,
        stats: {
          originalJsonLength,
          binaryCompressedLength,
          base64EncodedLength,
          compressionRatio
        }
      };
    }
  
    /**
     * Decodes a compressed Base64 string back into the original WebAuthnData format.
     * It reconstructs the data based on the binary format defined in the `encode` method.
     *
     * @param encoded The Base64 string representing the compressed data.
     * @returns The decoded WebAuthnData object.
     */
    static decode(encoded: string): WebAuthnData {
      const compressed = this.base64ToBytes(encoded);
      // Create a DataView over the entire compressed buffer for reading byte by byte.
      const view = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);
      let offset = 0; // Current read position in the buffer
  
      // 1. Challenge (fixed 32 bytes)
      const challengeBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        challengeBytes[i] = view.getUint8(offset++);
      }
      const challenge = this.bytesToBase64(challengeBytes);
  
      // 2. Timeout (3 bytes - Uint24 reconstruction)
      // Combine the three bytes back into a single number.
      const timeout = (view.getUint8(offset++) << 16) |  // MSB shifted left 16 bits
                      (view.getUint8(offset++) << 8)  |  // Middle byte shifted left 8 bits
                      view.getUint8(offset++);          // LSB
  
      // 3. RpId length (1 byte) and data (variable bytes)
      const rpIdLength = view.getUint8(offset++);
      const rpIdBytes = new Uint8Array(rpIdLength);
      for (let i = 0; i < rpIdLength; i++) {
        rpIdBytes[i] = view.getUint8(offset++);
      }
      const rpId = new TextDecoder().decode(rpIdBytes); // Decode UTF-8 bytes back to string
  
      // 4. Flags (1 byte) - extract user verification and credential count
      const flags = view.getUint8(offset++);
      const userVerification = (flags & 0x80) ? 'required' : 'preferred'; // Check bit 7
      const credCount = flags & 0x7F; // Extract lower 7 bits for count
  
      // 5. Credentials (variable length for each)
      const allowCredentials = [];
      for (let i = 0; i < credCount; i++) {
        const idLength = view.getUint8(offset++); // Read length of current credential ID
        const idBytes = new Uint8Array(idLength);
        for (let j = 0; j < idLength; j++) {
          idBytes[j] = view.getUint8(offset++); // Read raw bytes of credential ID
        }
        allowCredentials.push({
          type: 'public-key', // Hardcoded as 'public-key' based on encoding assumption
          id: this.bytesToBase64(idBytes) // Convert raw bytes back to base64 string
        });
      }
  
      return {
        publicKey: {
          challenge,
          timeout,
          rpId,
          allowCredentials,
          userVerification
        }
      };
    }
  
    /**
     * Calculates a simple 32-bit hash for a string.
     * This is a non-cryptographic hash suitable for scenarios where a small,
     * deterministic representation of a string is needed for comparison or lookup,
     * rather than security.
     * Used as part of the hash-based compression strategy.
     * @param str The input string.
     * @returns A 32-bit unsigned integer hash.
     */
    private static simpleHash(str: string): number {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        // Standard string hashing algorithm (SDBM or DJB2 variant)
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Ensures result is a 32-bit integer (can be signed)
      }
      return hash >>> 0; // Convert to unsigned 32-bit integer
    }
  
    /**
     * Encodes WebAuthnData using an experimental hash-based compression strategy.
     * This method stores only the first 8 bytes of each credential ID (as a truncated hash)
     * and a 4-byte hash of the `rpId`. This allows for even smaller compressed sizes
     * but requires an external mechanism (like a database lookup) to retrieve the full
     * credential IDs and `rpId` on the decoding side.
     *
     * @param data The WebAuthnData object to encode.
     * @returns An object containing the encoded Base64 string, an array of original full credential IDs (for external matching), and compression statistics.
     */
    static encodeWithHashing(data: WebAuthnData): { encoded: string, hashes: string[], stats: { originalJsonLength: number; binaryCompressedLength: number; base64EncodedLength: number; compressionRatio: number; }; } {
      // A smaller buffer is typically sufficient for hash-based compression.
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);
      let offset = 0;
  
      // 1. Challenge (fixed 32 bytes)
      const challengeBytes = this.base64ToBytes(data.publicKey.challenge);
      for (let i = 0; i < challengeBytes.length; i++) {
        view.setUint8(offset++, challengeBytes[i]);
      }
  
      // 2. Timeout (3 bytes - Uint24)
      view.setUint8(offset++, (data.publicKey.timeout >> 16) & 0xFF);
      view.setUint8(offset++, (data.publicKey.timeout >> 8) & 0xFF);
      view.setUint8(offset++, data.publicKey.timeout & 0xFF);
  
      // 3. RpId hash (4 bytes - Uint32)
      const rpIdHash = this.simpleHash(data.publicKey.rpId);
      // Use true for little-endian; for network transmission, big-endian might be preferred,
      // but for internal utility, consistency is key.
      view.setUint32(offset, rpIdHash, true);
      offset += 4;
  
      // 4. Flags byte: User Verification (bit 7) and Credential Count (bits 0-6)
      let flags = (data.publicKey.userVerification === 'required' ? 0x80 : 0x00);
      const credCount = data.publicKey.allowCredentials.length;
      // if (credCount > 127) {
      //   console.warn("More than 127 credentials for hash-based encoding. Count will be truncated to 127.");
      //   // The lower 7 bits will effectively truncate the count if it exceeds 127.
      // }
      flags |= (credCount & 0x7F); // Mask to use only 7 bits for count
      view.setUint8(offset++, flags);
  
      // 5. Store full IDs separately (returned as `hashes` for external matching),
      // and store only the first 8 bytes of each credential ID in the compressed data.
      const fullIds: string[] = []; // Stores original full IDs for potential later matching
      for (const cred of data.publicKey.allowCredentials) {
        fullIds.push(cred.id); // Add original full ID to the list
        const idBytes = this.base64ToBytes(cred.id);
        // Store only the first 8 bytes of the credential ID
        for (let i = 0; i < Math.min(8, idBytes.length); i++) {
          view.setUint8(offset++, idBytes[i]);
        }
      }
  
      // Trim the buffer to the actual size used.
      const compressed = new Uint8Array(buffer, 0, offset);
  
      // Convert the raw bytes to a URL-safe base64 string.
      const encoded = this.bytesToBase64(compressed);
  
      // Calculate and return compression statistics.
      const originalJsonLength = JSON.stringify(data).length;
      const binaryCompressedLength = compressed.length;
      const base64EncodedLength = encoded.length;
      const compressionRatio = Math.round((1 - base64EncodedLength / originalJsonLength) * 100);
  
      return {
        encoded,
        hashes: fullIds, // Return the original full IDs; these are NOT part of the compressed string.
        stats: {
          originalJsonLength,
          binaryCompressedLength,
          base64EncodedLength,
          compressionRatio
        }
      };
    }
  
    /**
     * Decodes a hash-based compressed Base64 string back into WebAuthnData format.
     * This method reconstructs placeholder credential IDs (based on their 8-byte hash)
     * and requires the `rpId` to be provided or looked up externally, as only its hash
     * was stored.
     *
     * @param encoded The Base64 string representing the hash-compressed data.
     * @param knownRpId Optional: The RpId string if it's known on the decoding side (e.g., from a context or database). Defaults to "localhost".
     * @returns The decoded WebAuthnData object with placeholder credential IDs.
     */
    static decodeWithHashing(encoded: string, knownRpId: string = "localhost"): WebAuthnData {
      const compressed = this.base64ToBytes(encoded);
      const view = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);
      let offset = 0;
  
      // 1. Challenge (fixed 32 bytes)
      const challengeBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        challengeBytes[i] = view.getUint8(offset++);
      }
      const challenge = this.bytesToBase64(challengeBytes);
  
      // 2. Timeout (3 bytes - Uint24 reconstruction)
      const timeout = (view.getUint8(offset++) << 16) |
                      (view.getUint8(offset++) << 8)  |
                      view.getUint8(offset++);
  
      // 3. RpId hash (4 bytes)
      // The actual rpId needs to be resolved here, either by a lookup based on the hash
      // or by being passed as a known value (as done with `knownRpId` parameter).
      const rpIdHash = view.getUint32(offset, true); // Read 4-byte hash (little-endian)
      offset += 4;
  
      // 4. Flags (1 byte) - extract user verification and credential count
      const flagsByte = view.getUint8(offset++);
      const userVerification = (flagsByte & 0x80) ? 'required' : 'preferred';
      const credCount = flagsByte & 0x7F; // Extract lower 7 bits for count
  
      // 5. Credential hashes (8 bytes each)
      const allowCredentials = [];
      for (let i = 0; i < credCount; i++) {
        const hashBytes = new Uint8Array(8);
        for (let j = 0; j < 8; j++) {
          hashBytes[j] = view.getUint8(offset++);
        }
        // Create a placeholder ID using the 8-byte hash.
        // In a real application, this hash would be used to look up the full credential ID
        // from a database or a pre-shared list.
        const placeholderId = this.bytesToBase64(hashBytes) + "_HASHED"; // Suffix for clarity
        allowCredentials.push({
          type: 'public-key',
          id: placeholderId
        });
      }
  
      return {
        publicKey: {
          challenge,
          timeout,
          rpId: knownRpId, // Use the provided or default known RpId
          allowCredentials,
          userVerification
        }
      };
    }
  
    /**
     * Helper method to match decoded hash-based credential IDs with full original IDs.
     * This function is crucial when `encodeWithHashing` was used and the full
     * credential IDs are needed on the decoding side. It attempts to find a match
     * within a list of `knownCredentials` by comparing the first 8 bytes (the stored hash).
     *
     * @param decodedData The WebAuthnData object decoded using `decodeWithHashing` (contains placeholder IDs).
     * @param knownCredentials An array of full credential objects (with `type` and `id`) that are known to the system (e.g., from a user's stored credentials).
     * @returns A new WebAuthnData object where placeholder IDs in `allowCredentials` are replaced with their full IDs if a match is found. If no match, the placeholder ID remains.
     */
    static matchHashedCredentials(
      decodedData: WebAuthnData,
      knownCredentials: Array<{type: string, id: string}>
    ): WebAuthnData {
      const matched = decodedData.publicKey.allowCredentials.map(hashedCred => {
        // Extract the base64 hash part (remove the "_HASHED" suffix if present)
        const hashPart = hashedCred.id.replace('_HASHED', '');
        const hashBytes = this.base64ToBytes(hashPart);
  
        // Attempt to find a matching credential from the `knownCredentials` list.
        const match = knownCredentials.find(known => {
          const knownBytes = this.base64ToBytes(known.id);
          // Compare the first 8 bytes of the known ID with the hash part of the decoded ID.
          for (let i = 0; i < Math.min(8, knownBytes.length, hashBytes.length); i++) {
            if (knownBytes[i] !== hashBytes[i]) return false; // Mismatch found
          }
          return true; // All 8 bytes matched, consider it a match
        });
  
        return match || hashedCred; // Return the full matched credential or the original hashed one if no match was found.
      });
  
      return {
        publicKey: {
          ...decodedData.publicKey,
          allowCredentials: matched // Replace credential list with matched/original items
        }
      };
    }
  }
  
  // Test the encoder/decoder functionality
  function testUltraCompression() {

    console.log("its working------>");
    
    const originalData: WebAuthnData = {
      publicKey: {
        challenge: "40XpTY5Q4hyvO3yM4qRcshBePRkl6FHgDy4PYuJX8F8",
        timeout: 300000, // 5 minutes
        rpId: "localhost",
        allowCredentials: [
          { type: "public-key", id: "OugN-F9CmxRE8xYTWKD7kkzvbeY" },
          { type: "public-key", id: "HNfgLQmhBnXz_ako76y4GpqAoqQ" },
          { type: "public-key", id: "y8Dz3XUZgsXBNcqFS3Nij_E8rjQ" },
          { type: "public-key", id: "Y_h40W59KyQ2KG507FHM-xc_5MU" },
          { type: "public-key", id: "uypGzx6dOSaNrgWF37hl9keh-Mw" },
          { type: "public-key", id: "-Ev6fcmbHTjvu_wJxj5sMZGSLIo" },
          { type: "public-key", id: "OGHM73Sb_W1xHyStHapeXGYYirY" },
          { type: "public-key", id: "CKFW08pYQUARbNEbEqWZRg" },
          { type: "public-key", id: "DjgaDuDMpapyJJdj4CG24mO6dNM" },
          { type: "public-key", id: "MM2hKUfB0rKDTieTiQ-K-91BYwA" },
          { type: "public-key", id: "cOnB_rCg9s1qDSFIG-_erQ" },
          { type: "public-key", id: "yTWkIE5pQsiYMOkmnUy0VeyerqQ" },
          { type: "public-key", id: "whhUQQfDlv84iMVaQN6MNz_SF3o" },
          { type: "public-key", id: "v8dwOBWz39JjRvHOVvc1CepXuGA" },
          { type: "public-key", id: "Ea72tzsk-FcWajiGMHg490-qsf0" },
          { type: "public-key", id: "gKwrTxkj-zEqZr1aiedpW04o_aM" },
          { type: "public-key", id: "MrVRqVl12Y4h6nLfD6w26pWctLpp46RFA72px9ucjug" },
          { type: "public-key", id: "MBA4M6T9X2M7MLZOAXAwhgkTzzQ" },
          { type: "public-key", id: "ZIZGPm_Xtc5zkknT1KlfSpVCSpye8EP1BRBVDMzMq8o" },
          { type: "public-key", id: "T7EwCYnHuofhTfhKF2Dmtg" },
          { type: "public-key", id: "L3G19Hk9qrmlBw82TuO9pw" },
          { type: "public-key", id: "saGaLBBb06Uvk0TdqlPYzw" }
        ],
        userVerification: "required"
      }
    };
  
    // Test standard encoding
    const standardResult = UltraCompressor.encode(originalData);
  
    // Test standard decoding
    const decodedStandard = UltraCompressor.decode(standardResult.encoded);
  
    // Verify if decoded data matches original data (for essential fields)
    const isStandardMatch = (
      decodedStandard.publicKey.challenge === originalData.publicKey.challenge &&
      decodedStandard.publicKey.timeout === originalData.publicKey.timeout &&
      decodedStandard.publicKey.rpId === originalData.publicKey.rpId &&
      decodedStandard.publicKey.userVerification === originalData.publicKey.userVerification &&
      decodedStandard.publicKey.allowCredentials.length === originalData.publicKey.allowCredentials.length &&
      decodedStandard.publicKey.allowCredentials.every((cred, i) =>
        cred.id === originalData.publicKey.allowCredentials[i].id &&
        cred.type === originalData.publicKey.allowCredentials[i].type
      )
    );
  
  
    // Test hash-based encoding
    const hashResult = UltraCompressor.encodeWithHashing(originalData);
  
    // Test hash-based decoding
    const decodedHashed = UltraCompressor.decodeWithHashing(hashResult.encoded, originalData.publicKey.rpId);
  
    // Test matching hashed credentials
    const matchedHashedData = UltraCompressor.matchHashedCredentials(
      decodedHashed,
      originalData.publicKey.allowCredentials // Provide the original credentials for matching
    );
  
    // Verify if decoded and matched data matches original data
    const isHashMatch = (
      matchedHashedData.publicKey.challenge === originalData.publicKey.challenge &&
      matchedHashedData.publicKey.timeout === originalData.publicKey.timeout &&
      matchedHashedData.publicKey.rpId === originalData.publicKey.rpId &&
      matchedHashedData.publicKey.userVerification === originalData.publicKey.userVerification &&
      matchedHashedData.publicKey.allowCredentials.length === originalData.publicKey.allowCredentials.length &&
      matchedHashedData.publicKey.allowCredentials.every((cred, i) =>
        cred.id === originalData.publicKey.allowCredentials[i].id &&
        cred.type === originalData.publicKey.allowCredentials[i].type
      )
    );
  }
  
  // Run the test
  testUltraCompression();
  
// Export the interface and class for use in other files
export { UltraCompressor,testUltraCompression };
export type { WebAuthnData };
