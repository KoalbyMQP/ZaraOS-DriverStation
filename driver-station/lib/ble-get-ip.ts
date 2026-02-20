"use client";

import { BLE_UUIDS } from "./ble-uuid";

const CHUNK_SIZE = 250;
const RESPONSE_TIMEOUT_MS = 30000;

/**
 * Connect to a robot via Web Bluetooth (same flow as BLEConnection.js),
 * request its IP over the communication characteristic, then disconnect.
 * Returns { name, ip } for use with ConnectionContext.connect().
 */
export async function connectBLEAndGetIP(): Promise<{ name: string; ip: string }> {
  if (typeof navigator === "undefined" || !navigator.bluetooth) {
    throw new Error("Web Bluetooth is not available in this browser.");
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BLE_UUIDS.INTERACTIVE_SERVICE_UUID] }],
    optionalServices: [],
  });

  const name = device.name?.trim() || "Robot";

  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(BLE_UUIDS.INTERACTIVE_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(
    BLE_UUIDS.COMMUNICATION_CHARACTERISTIC_UUID
  );

  try {
    const ip = await sendGetIP(characteristic);
    return { name, ip };
  } finally {
    try {
      device.gatt?.disconnect();
    } catch {
      // ignore
    }
  }
}

/**
 * Send "get-ip" to the communication characteristic and wait for the IP response.
 * Mirrors BLEConnection.sendMessageToCharacteristic / get_ip() behavior.
 */
async function sendGetIP(
  characteristic: BluetoothRemoteGATTCharacteristic
): Promise<string> {
  return new Promise((resolve, reject) => {
    let fullMessage = "";
    let success = true;
    let responseTimeout: ReturnType<typeof setTimeout>;
    let isComplete = false;

    const cleanup = () => {
      isComplete = true;
      clearTimeout(responseTimeout);
      try {
        characteristic.removeEventListener(
          "characteristicvaluechanged",
          onCharacteristicValueChanged
        );
      } catch {
        // ignore
      }
    };

    const onCharacteristicValueChanged = (event: Event) => {
      if (isComplete) return;
      const target = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (!target) return;

      const decoder = new TextDecoder();
      const decodedData = decoder.decode(target);

      if (decodedData === "" || decodedData === "\0") {
        cleanup();
        resolve("");
        return;
      }

      if (fullMessage === "" && decodedData.includes(",")) {
        const firstComma = decodedData.indexOf(",");
        const statusChar = decodedData.substring(0, firstComma);
        const remaining = decodedData.substring(firstComma + 1);
        if (statusChar === "0" || statusChar === "1") {
          success = statusChar === "0";
          fullMessage += remaining;
        } else {
          fullMessage += decodedData;
        }
      } else {
        fullMessage += decodedData;
      }

      const isSmallMessage = decodedData.length < CHUNK_SIZE;
      const hasTerminator =
        decodedData.endsWith("\0") || fullMessage.endsWith("\0");
      if (isSmallMessage || hasTerminator) {
        cleanup();
        const cleanMessage = fullMessage.replace(/\0+$/, "");
        if (success) {
          resolve(cleanMessage);
        } else {
          reject(new Error(cleanMessage || "Command failed"));
        }
      }
    };

    characteristic.addEventListener(
      "characteristicvaluechanged",
      onCharacteristicValueChanged
    );

    responseTimeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Response timeout (${RESPONSE_TIMEOUT_MS / 1000}s)`));
    }, RESPONSE_TIMEOUT_MS);

    (async () => {
      try {
        if (characteristic.properties.notify) {
          await characteristic.startNotifications();
        }
        const message = "get-ip\0";
        const encoder = new TextEncoder();
        for (let i = 0; i < Math.ceil(message.length / CHUNK_SIZE); i++) {
          const chunk = message.substring(
            i * CHUNK_SIZE,
            (i + 1) * CHUNK_SIZE
          );
          await characteristic.writeValue(encoder.encode(chunk));
          if (i < Math.ceil(message.length / CHUNK_SIZE) - 1) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }
      } catch (err) {
        cleanup();
        reject(err);
      }
    })();
  });
}
