// Mock Chrome APIs
const mockCookies = [
  { name: "NID", value: "nid_value" },
  { name: "SID", value: "sid_value" },
  { name: "__Secure-1PSID", value: "s1psid_value" }
];

global.chrome = {
  cookies: {
    getAll: jest.fn((details, callback) => {
      if (callback) {
        callback(mockCookies);
      } else {
        return Promise.resolve(mockCookies);
      }
    }) as any
  },
  runtime: {
    lastError: undefined
  },
  downloads: {
    onDeterminingFilename: {
      addListener: jest.fn()
    }
  }
} as any;

import { getEncodedCookies } from "../src/background";
import pako from "pako";

// Helper to decode base64
const atob = (base64: string) =>
  Buffer.from(base64, "base64").toString("binary");

describe("getEncodedCookies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.runtime.lastError = undefined;
  });

  test("should remove the NID cookie", async () => {
    const url = "https://takeout.google.com";
    const encodedCookies = await getEncodedCookies(url);

    expect(chrome.cookies.getAll).toHaveBeenCalledWith(
      { url },
      expect.any(Function)
    );

    const binaryString = atob(encodedCookies);
    const compressedData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedData[i] = binaryString.charCodeAt(i);
    }

    const decompressedData = pako.ungzip(compressedData);
    const decoder = new TextDecoder();
    const decodedString = decoder.decode(decompressedData);

    expect(decodedString).not.toContain("NID=nid_value");
    expect(decodedString).toContain("SID=sid_value");
    expect(decodedString).toContain("__Secure-1PSID=s1psid_value");
  });

  test("should return a base64 encoded gzipped string", async () => {
    const url = "https://takeout.google.com";
    const encodedCookies = await getEncodedCookies(url);

    // Check if it's a valid base64 string
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    expect(base64Regex.test(encodedCookies)).toBe(true);

    // Decode and decompress
    const binaryString = atob(encodedCookies);
    const compressedData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedData[i] = binaryString.charCodeAt(i);
    }

    let decompressedData;
    try {
      decompressedData = pako.ungzip(compressedData);
    } catch (e) {
      throw new Error("Failed to ungzip the data");
    }

    const decoder = new TextDecoder();
    const decodedString = decoder.decode(decompressedData);

    const expectedString = "SID=sid_value; __Secure-1PSID=s1psid_value";
    expect(decodedString).toBe(expectedString);
  });

  test("should handle chrome.runtime.lastError", async () => {
    const url = "https://takeout.google.com";
    global.chrome.runtime.lastError = { message: "Test error" };
    (chrome.cookies.getAll as any) = jest.fn((details, callback) => {
      callback([]);
    });

    await expect(getEncodedCookies(url)).rejects.toEqual({
      message: "Test error"
    });
  });
});
