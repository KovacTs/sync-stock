import net from 'net';
import zlib from 'zlib';

/**
 * Helper to compress JSON payloads using zlib and encode in base64.
 */
function compressPayload(payload: string): string {
  if (payload.startsWith('{') || payload.startsWith('[')) {
    try {
      const compressed = zlib.deflateSync(payload).toString('base64');
      return '_Z_' + compressed;
    } catch (e) {
      console.error('[SOABus] Compression error:', e);
      return payload;
    }
  }
  return payload;
}

/**
 * Helper to decompress base64-encoded zlib compressed payloads.
 */
function decompressPayload(payload: string): string {
  if (payload.startsWith('_Z_')) {
    try {
      const compressed = payload.substring(3);
      return zlib.inflateSync(Buffer.from(compressed, 'base64')).toString('utf-8');
    } catch (e) {
      console.error('[SOABus] Decompression error:', e);
      return payload;
    }
  }
  return payload;
}

/**
 * Encapsulates message formatting for the ESB: nnnnnSSSSSDATOS
 * Uses Buffer.byteLength to prevent character/byte mismatches with UTF-8 characters.
 */
export function sendSOAMessage(socket: net.Socket, serviceName: string, payload: string) {
  const cleanService = serviceName.padEnd(5).substring(0, 5);
  const processedPayload = compressPayload(payload);
  const content = cleanService + processedPayload;
  const byteLen = Buffer.byteLength(content, 'utf-8');
  const lengthStr = byteLen.toString().padStart(5, '0');
  socket.write(lengthStr + content);
}

/**
 * Encapsulates response formatting for the ESB: nnnnnSSSSSRESULTADODATOS
 * Uses Buffer.byteLength to prevent character/byte mismatches with UTF-8 characters.
 */
export function sendSOAResponse(socket: net.Socket, serviceName: string, result: 'OK' | 'NK', payload: string) {
  const cleanService = serviceName.padEnd(5).substring(0, 5);
  const processedPayload = compressPayload(payload);
  const content = cleanService + result + processedPayload;
  const byteLen = Buffer.byteLength(content, 'utf-8');
  const lengthStr = byteLen.toString().padStart(5, '0');
  socket.write(lengthStr + content);
}

/**
 * Sends a synchronous request-response call to the ESB by opening a temporary TCP socket.
 * Handles framing on binary Buffer length instead of character length.
 */
export function requestSOABus(serviceName: string, payload: string): Promise<{ status: 'OK' | 'NK'; data: string }> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    const timeoutMs = 8000;

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TIMEOUT: No response from ESB service "${serviceName}" within ${timeoutMs}ms`));
    }, timeoutMs);

    socket.connect(5000, 'localhost', () => {
      sendSOAMessage(socket, serviceName, payload);
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length >= 5) {
        const len = parseInt(buffer.subarray(0, 5).toString('utf-8'), 10);
        if (isNaN(len)) {
          clearTimeout(timer);
          socket.destroy();
          reject(new Error('INVALID_FRAME_LENGTH'));
          return;
        }

        if (buffer.length >= 5 + len) {
          clearTimeout(timer);
          const contentBuf = buffer.subarray(5, 5 + len);
          socket.destroy();

          const content = contentBuf.toString('utf-8');
          const service = content.substring(0, 5);
          let rest = content.substring(5);

          let actionName = 'unknown';
          let isQuery = false;
          try {
            const parsed = JSON.parse(payload);
            actionName = parsed.action || 'unknown';
            const silentActions = ['products', 'orders', 'reservations', 'history', 'stock'];
            if (silentActions.includes(actionName)) {
              isQuery = true;
            }
          } catch (e) {
            if (serviceName === 'autho') {
              actionName = 'login';
            }
          }

          if (!isQuery) {
            console.log(`[SOABus Transaction] Service: "${serviceName}", Action: "${actionName}" -> Initiated`);
            console.log(`[SOABus Client Debug] Raw content: "${content.substring(0, 200)}${content.length > 200 ? '...' : ''}"`);
          }

          let status: 'OK' | 'NK' = 'OK';

          // First header strip
          if (rest.startsWith('OK')) {
            status = 'OK';
            rest = rest.substring(2);
          } else if (rest.startsWith('NK')) {
            status = 'NK';
            rest = rest.substring(2);
          }

          // Second header strip (handles bus prepending its own status on top of service status)
          if (rest.startsWith('OK')) {
            rest = rest.substring(2);
          } else if (rest.startsWith('NK')) {
            status = 'NK';
            rest = rest.substring(2);
          }

          const responseData = rest;
          const decompressedData = decompressPayload(responseData);

          if (!isQuery) {
            console.log(`[SOABus Client Debug] Parsed -> Service: "${service}", Status: "${status}", Data: "${decompressedData.substring(0, 200)}${decompressedData.length > 200 ? '...' : ''}"`);
            console.log(`[SOABus Transaction] Service: "${serviceName}", Action: "${actionName}" -> Status: ${status}`);
          }

          resolve({ status, data: decompressedData });
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Registers a persistent TCP client as a service in the ESB.
 * Reconnects automatically if connection is lost.
 * Handles framing on binary Buffer length instead of character length.
 */
export function registerSOAService(serviceName: string, onRequestHandler: (payload: string) => Promise<string>) {
  const cleanService = serviceName.padEnd(5).substring(0, 5);
  let socket = new net.Socket();
  let buffer = Buffer.alloc(0);
  let isConnected = false;

  const connect = () => {
    if (isConnected) return;
    console.log(`[SOABus Service ${cleanService}] Connecting to ESB on port 5000...`);
    
    socket = new net.Socket();
    buffer = Buffer.alloc(0);

    socket.connect(5000, 'localhost', () => {
      isConnected = true;
      console.log(`[SOABus Service ${cleanService}] Connected. Registering service...`);
      sendSOAMessage(socket, 'sinit', cleanService);
    });

    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 5) {
        const len = parseInt(buffer.subarray(0, 5).toString('utf-8'), 10);
        if (isNaN(len)) {
          console.error(`[SOABus Service ${cleanService}] Corrupted frame prefix. Resetting buffer.`);
          buffer = Buffer.alloc(0);
          return;
        }

        if (buffer.length < 5 + len) {
          break; // Frame is incomplete, wait for next data chunk
        }

        const contentBuf = buffer.subarray(5, 5 + len);
        buffer = buffer.subarray(5 + len);

        const content = contentBuf.toString('utf-8');
        const service = content.substring(0, 5);
        const payload = decompressPayload(content.substring(5));

        if (service === 'sinit') {
          console.log(`[SOABus Service ${cleanService}] Registered successfully. ESB Confirmation: ${payload}`);
          continue;
        }

        // Process actual business logic in handler
        try {
          const response = await onRequestHandler(payload);
          sendSOAResponse(socket, cleanService, 'OK', response);
        } catch (err: any) {
          sendSOAResponse(socket, cleanService, 'NK', err.message || 'Unknown internal service error');
        }
      }
    });

    socket.on('close', () => {
      isConnected = false;
      console.warn(`[SOABus Service ${cleanService}] Connection lost. Reconnecting in 5 seconds...`);
      setTimeout(connect, 5000);
    });

    socket.on('error', (err) => {
      console.error(`[SOABus Service ${cleanService}] Socket error:`, err.message);
    });
  };

  connect();
}
