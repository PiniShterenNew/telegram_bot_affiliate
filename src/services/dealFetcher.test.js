const axios = require('axios');
const { getEbayAccessToken } = require('../auth/ebayAuth');
const { fetchDealsFromStrategy } = require('./dealFetcher');

// Mock dependencies
jest.mock('axios');
jest.mock('../auth/ebayAuth'); // Mocking the entire module

// Store original console.error and console.log
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('dealFetcher', () => {
  const mockStrategy = {
    strategy_id: 'test_strategy',
    keywords: ['test', 'keyword'],
    max_price_usd: 50,
    min_price_usd: 10,
    category_ids: ['12345'],
    prefer_free_shipping: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output during tests
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterAll(() => {
    // Restore console output
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe('fetchDealsFromStrategy', () => {
    it('should throw an error if getEbayAccessToken fails', async () => {
      getEbayAccessToken.mockRejectedValue(new Error('eBay auth failed'));
      
      console.error = originalConsoleError; // Check actual console output for this test
      await expect(fetchDealsFromStrategy(mockStrategy)).rejects.toThrow('eBay auth failed');
    });

    it('should throw an error if eBay API call fails', async () => {
      getEbayAccessToken.mockResolvedValue('fake_access_token');
      axios.get.mockRejectedValue(new Error('eBay API error'));

      console.error = originalConsoleError; // Check actual console output
      await expect(fetchDealsFromStrategy(mockStrategy)).rejects.toThrow('eBay API error');
    });

    it('should return an empty array if eBay API returns no items', async () => {
      getEbayAccessToken.mockResolvedValue('fake_access_token');
      axios.get.mockResolvedValue({ data: { itemSummaries: [] } }); // No items

      const result = await fetchDealsFromStrategy(mockStrategy);
      expect(result).toEqual([]);
    });
    
    it('should return an empty array if eBay API returns no itemSummaries field', async () => {
      getEbayAccessToken.mockResolvedValue('fake_access_token');
      axios.get.mockResolvedValue({ data: {} }); // No itemSummaries field

      const result = await fetchDealsFromStrategy(mockStrategy);
      expect(result).toEqual([]);
    });

    it('should return processed deals on successful API call with items', async () => {
      getEbayAccessToken.mockResolvedValue('fake_access_token');
      const mockEbayItems = [
        {
          itemId: 'v1|123|0',
          title: 'Test Item 1',
          price: { value: '25.00', currency: 'USD' },
          image: { imageUrl: 'http://example.com/image1.jpg' },
          itemWebUrl: 'http://ebay.com/item1',
          shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '0.00', currency: 'USD' } }],
          condition: 'NEW',
          itemLocation: { country: 'US' },
          buyingOptions: ['FIXED_PRICE'],
          seller: { username: 'test_seller', feedbackScore: 100 },
        },
        {
          itemId: 'v1|456|0',
          title: 'Test Item 2',
          price: { value: '30.00', currency: 'USD' },
          // No direct image, should fallback or use thumbnail
          thumbnailImages: [{ imageUrl: 'http://example.com/image2_thumb.jpg' }],
          itemWebUrl: 'http://ebay.com/item2',
          shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '5.00', currency: 'USD' } }],
          condition: 'USED',
          itemLocation: { country: 'GB' },
          buyingOptions: ['AUCTION'],
          seller: { username: 'another_seller', feedbackScore: 99 },
          marketingPrice: {
            originalPrice: { value: '40.00', currency: 'USD'},
            discountPercentage: '25'
          }
        },
      ];
      axios.get.mockResolvedValue({ data: { itemSummaries: mockEbayItems } });

      const result = await fetchDealsFromStrategy(mockStrategy);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0); // Will be 2 after filtering/processing
      
      // Check structure of the first processed item
      const firstResult = result[0];
      expect(firstResult).toHaveProperty('itemId', 'v1|123|0');
      expect(firstResult).toHaveProperty('title', 'Test Item 1');
      expect(firstResult).toHaveProperty('price', 25.00);
      expect(firstResult).toHaveProperty('galleryURL', 'http://example.com/image1.jpg');
      expect(firstResult).toHaveProperty('viewItemURL', 'http://ebay.com/item1');
      expect(firstResult).toHaveProperty('shippingServiceCost', 0);
      expect(firstResult.originalPrice).toBeNull(); // No marketingPrice in mockEbayItems[0]

      const secondResult = result[1];
      expect(secondResult).toHaveProperty('itemId', 'v1|456|0');
      expect(secondResult).toHaveProperty('title', 'Test Item 2');
      expect(secondResult).toHaveProperty('price', 30.00);
      expect(secondResult).toHaveProperty('galleryURL', 'http://example.com/image2_thumb.jpg');
      expect(secondResult).toHaveProperty('originalPrice', 40.00);
      expect(secondResult).toHaveProperty('discountPercentage', '25');

    });

    it('should correctly filter items based on shipping cost', async () => {
        getEbayAccessToken.mockResolvedValue('fake_access_token');
        const mockEbayItems = [
          // Item with free shipping
          { itemId: 'v1|free|0', title: 'Free Shipping Item', price: { value: '20.00' }, shippingOptions: [{ shippingCost: { value: '0.00' }}], itemWebUrl: 'http://example.com/item_free_ship' },
          // Item with cheap shipping (cost <= 3% of price)
          { itemId: 'v1|cheap|0', title: 'Cheap Shipping Item', price: { value: '100.00' }, shippingOptions: [{ shippingCost: { value: '3.00' }}], itemWebUrl: 'http://example.com/item_cheap_ship' },
          // Item with reasonable absolute shipping (cost <= $8)
          { itemId: 'v1|absolute|0', title: 'Absolute Shipping Item', price: { value: '50.00' }, shippingOptions: [{ shippingCost: { value: '7.99' }}], itemWebUrl: 'http://example.com/item_abs_ship' },
          // Item with expensive shipping
          { itemId: 'v1|expensive|0', title: 'Expensive Shipping Item', price: { value: '20.00' }, shippingOptions: [{ shippingCost: { value: '10.00' }}], itemWebUrl: 'http://example.com/item_exp_ship' },
          // Item with expensive shipping relative to price
          { itemId: 'v1|relative_expensive|0', title: 'Relative Expensive Shipping Item', price: { value: '50.00' }, shippingOptions: [{ shippingCost: { value: '9.00' }}], itemWebUrl: 'http://example.com/item_rel_exp_ship' },
        ];
        axios.get.mockResolvedValue({ data: { itemSummaries: mockEbayItems } });
  
        const result = await fetchDealsFromStrategy(mockStrategy);
        expect(result.length).toBe(3); // Only the first three items should pass
        expect(result.some(deal => deal.itemId === 'v1|free|0')).toBe(true);
        expect(result.some(deal => deal.itemId === 'v1|cheap|0')).toBe(true);
        expect(result.some(deal => deal.itemId === 'v1|absolute|0')).toBe(true);
        expect(result.some(deal => deal.itemId === 'v1|expensive|0')).toBe(false);
        expect(result.some(deal => deal.itemId === 'v1|relative_expensive|0')).toBe(false);
      });

    it('should use fallback image URL if primary image is missing or invalid', async () => {
        getEbayAccessToken.mockResolvedValue('fake_access_token');
        const mockEbayItems = [
          { 
            itemId: 'v1|imgfallback|0', 
            title: 'Image Fallback Test', 
            price: { value: '10.00' }, 
            itemWebUrl: 'http://example.com/item_img_fallback',
            // No image or thumbnailImages
          },
        ];
        axios.get.mockResolvedValue({ data: { itemSummaries: mockEbayItems } });
  
        const result = await fetchDealsFromStrategy(mockStrategy);
        expect(result[0].galleryURL).toBe('https://i.ebayimg.com/images/g/v1|imgfallback|0/s-l300.jpg');
    });

    it('should reconstruct itemWebUrl if it seems to be an affiliate link', async () => {
        getEbayAccessToken.mockResolvedValue('fake_access_token');
        const mockEbayItems = [
          { 
            itemId: 'v1|affiliate|0', 
            title: 'Affiliate URL Test', 
            price: { value: '10.00' }, 
            itemWebUrl: 'https://rover.ebay.com/some_affiliate_stuff/v1|affiliate|0', // Affiliate link
            image: { imageUrl: 'http://example.com/image.jpg' },
          },
        ];
        axios.get.mockResolvedValue({ data: { itemSummaries: mockEbayItems } });
  
        const result = await fetchDealsFromStrategy(mockStrategy);
        expect(result[0].viewItemURL).toBe('https://www.ebay.com/itm/v1|affiliate|0');
    });
  });
});
