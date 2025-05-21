const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config'); // Original config
const { getEbayAccessToken } = require('./ebayAuth');

// Mock the config module
jest.mock('../config', () => ({
  // Default mock values, can be overridden per test
  EBAY_CLIENT_ID: 'test_client_id',
  EBAY_CLIENT_SECRET: 'test_client_secret',
  EBAY_SCOPE: 'test_scope',
}));

// Mock fs operations
jest.mock('fs');

// Store the original console.error and console.log
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('ebayAuth', () => {
  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();
    // Suppress console.error and console.log for most tests to keep output clean
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterAll(() => {
    // Restore original console.error and console.log after all tests
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe('getEbayAccessToken', () => {
    it('should return a cached token if valid', async () => {
      const validToken = {
        access_token: 'valid_cached_token',
        expires_at: Date.now() + 3600 * 1000, // Expires in 1 hour
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(validToken));

      const token = await getEbayAccessToken();
      expect(token).toBe('valid_cached_token');
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should fetch a new token if no cached token exists', async () => {
      fs.existsSync.mockReturnValue(false); // No cached token
      axios.post.mockResolvedValue({
        data: {
          access_token: 'new_ebay_token',
          expires_in: 7200,
        },
      });

      const token = await getEbayAccessToken();
      expect(token).toBe('new_ebay_token');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('ebay_token.json'), // path.join might make this OS-specific
        expect.any(String) // We can be more specific if needed
      );
    });

    it('should fetch a new token if cached token is expired', async () => {
      const expiredToken = {
        access_token: 'expired_token',
        expires_at: Date.now() - 3600 * 1000, // Expired 1 hour ago
      };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(expiredToken));
      axios.post.mockResolvedValue({
        data: {
          access_token: 'new_token_after_expiry',
          expires_in: 7200,
        },
      });

      const token = await getEbayAccessToken();
      expect(token).toBe('new_token_after_expiry');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
    
    it('should save the new token with correct expiry (minus buffer)', async () => {
      fs.existsSync.mockReturnValue(false);
      const mockDateNow = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => mockDateNow); // Mock Date.now()
      
      axios.post.mockResolvedValue({
        data: {
          access_token: 'token_to_save',
          expires_in: 3600, // 1 hour
        },
      });

      await getEbayAccessToken();

      const expectedExpiresAt = mockDateNow + (3600 * 1000) - (5 * 60 * 1000); // 1 hour in ms minus 5 mins buffer
      const savedTokenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      
      expect(savedTokenData.access_token).toBe('token_to_save');
      expect(savedTokenData.expires_at).toBe(expectedExpiresAt);
      
      Date.now.mockRestore(); // Restore original Date.now()
    });

    it('should throw an error if eBay API returns an error', async () => {
      fs.existsSync.mockReturnValue(false);
      axios.post.mockRejectedValue({
        response: { data: { error: 'invalid_grant', error_description: 'Bad credentials' } },
        message: 'Request failed with status code 401'
      });

      // Restore console.error for this specific test to check its output
      console.error = originalConsoleError;
      await expect(getEbayAccessToken()).rejects.toThrow('Request failed with status code 401');
    });
    
    it('should log specific message for invalid_client error', async () => {
      fs.existsSync.mockReturnValue(false);
      axios.post.mockRejectedValue({
        response: { data: { error: 'invalid_client' } },
        message: 'Request failed'
      });
      
      const consoleErrorSpy = jest.spyOn(console, 'error'); // Spy on console.error
      
      await expect(getEbayAccessToken()).rejects.toThrow('Request failed');
      
      // Check if console.error was called with the specific invalid_client message
      let foundInvalidClientMessage = false;
      consoleErrorSpy.mock.calls.forEach(call => {
        if (call.join(' ').includes('אימות לקוח eBay נכשל')) {
          foundInvalidClientMessage = true;
        }
      });
      expect(foundInvalidClientMessage).toBe(true);
      
      consoleErrorSpy.mockRestore(); // Clean up spy
    });

    it('should throw an error if eBay credentials are not configured', async () => {
      // Override the mock for this specific test
      jest.doMock('../config', () => ({
        EBAY_CLIENT_ID: undefined, // Simulate missing credential
        EBAY_CLIENT_SECRET: 'anything',
      }));
      
      // We need to re-require the module for the new mock to take effect
      const { getEbayAccessToken: getEbayAccessTokenReMocked } = require('./ebayAuth');
      
      console.error = originalConsoleError; // Check console output
      await expect(getEbayAccessTokenReMocked()).rejects.toThrow('eBay API credentials missing');

      // Restore original mock
      jest.doMock('../config', () => ({
        EBAY_CLIENT_ID: 'test_client_id',
        EBAY_CLIENT_SECRET: 'test_client_secret',
        EBAY_SCOPE: 'test_scope',
      }));
    });
  });
});
