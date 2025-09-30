const axios = require('axios');

// Helper: trim and strip surrounding single/double quotes
const cleanEnv = (val, fallback = '') => {
  if (val == null) return String(fallback);
  const s = String(val).trim();
  // Remove one or more leading/trailing quotes
  return s.replace(/^\s*["']+|["']+\s*$/g, '');
};

class PostExService {
  constructor() {
    this.baseURL = cleanEnv(process.env.POSTEX_BASE_URL || 'https://api.postex.pk/services/integration/api/order');
    this.token = cleanEnv(process.env.POSTEX_API_TOKEN || '');
    this.isEnabled = cleanEnv(process.env.POSTEX_ENABLED || '').toLowerCase() === 'true';
    
    if (this.isEnabled && !this.token) {
      console.error('PostEx API token not configured (POSTEX_API_TOKEN). Disabling PostEx.');
      this.isEnabled = false;
    }

    // Dedicated axios instance to avoid global interceptors/header pollution
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 30000
    });
    this.http.interceptors.request.use((config) => {
      config.headers = config.headers || {};
      // Attach PostEx token header (required by PostEx)
      if (this.token) config.headers['token'] = this.token;
      // Duplicate in Authorization as a fallback for proxies that strip custom headers
      if (this.token && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (!config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
      return config;
    });
  }

  /**
   * Create order in PostEx system
   * @param {Object} orderData - Order data from your system
   * @returns {Promise<Object>} PostEx response
   */
  async createOrder(orderData) {
    if (!this.isEnabled) {
      throw new Error('PostEx service is disabled');
    }

    if (!this.token) {
      throw new Error('PostEx API token not configured');
    }

    try {
      const postexPayload = this.transformOrderToPostEx(orderData);
      
      console.log('Creating PostEx order:', JSON.stringify(postexPayload, null, 2));
      
      const response = await this.http.post(
        '/v3/create-order',
        postexPayload
      );

      console.log('PostEx order created successfully:', JSON.stringify(response.data, null, 2));
      
      // Log specific fields we're looking for
      console.log('PostEx Response Analysis:');
      console.log('- orderRefNumber:', response.data.orderRefNumber);
      console.log('- orderId:', response.data.orderId);
      console.log('- trackingNumber:', response.data.trackingNumber);
      console.log('- cn:', response.data.cn);
      console.log('- consignmentNumber:', response.data.consignmentNumber);
      console.log('- dist.trackingNumber:', response.data.dist?.trackingNumber);
      console.log('- dist.orderStatus:', response.data.dist?.orderStatus);
      console.log('- All response keys:', Object.keys(response.data));
      
      return response.data;

    } catch (error) {
      console.error('PostEx order creation failed:', error.response?.data || error.message);
      throw new Error(`PostEx API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get order status from PostEx
   * @param {string} orderRefNumber - PostEx order reference number
   * @returns {Promise<Object>} Order status
   */
  async getOrderStatus(orderRefNumber) {
    if (!this.isEnabled || !this.token) {
      throw new Error('PostEx service not properly configured');
    }

    try {
      const response = await this.http.get(
        `/v1/track-order/${orderRefNumber}`,
        { timeout: 15000 }
      );

      // Normalize PostEx tracking response
      const rawData = response.data;
      const details = rawData?.dist || rawData;

      // Prefer transactionStatus, fallback to orderStatus, then generic status
      const status = details?.transactionStatus || details?.orderStatus || rawData?.status || 'Unknown';
      const trackingNo = details?.trackingNumber || orderRefNumber;
      const lastEventAt = details?.orderStatusChangedAt || details?.orderDate || details?.transactionDate || new Date().toISOString();

      let normalized = {
        status,
        trackingNumber: trackingNo,
        lastEventAt,
        details
      };

      return normalized;
    } catch (error) {
      console.error('PostEx order tracking failed:', error.response?.data || error.message);
      throw new Error(`PostEx Tracking Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Cancel order in PostEx (by tracking number)
   * API: PUT /v1/cancel-order with body { trackingNumber }
   * @param {string} trackingNumber
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelOrder(trackingNumber) {
    if (!this.isEnabled || !this.token) {
      throw new Error('PostEx service not properly configured');
    }

    try {
      const response = await this.http.put(
        `/v1/cancel-order`,
        { trackingNumber },
        { timeout: 15000 }
      );

      return response.data;
    } catch (error) {
      console.error('PostEx order cancellation failed:', error.response?.data || error.message);
      throw new Error(`PostEx Cancellation Error: ${error.response?.data?.message || error.message}`);
    }
  }


  /**
   * Get order types from PostEx
   * @returns {Promise<Array>} List of order types
   */
  async getOrderTypes() {
    if (!this.isEnabled || !this.token) {
      throw new Error('PostEx service not properly configured');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/v1/get-order-types`,
        {
          headers: {
            'token': this.token
          },
          timeout: 15000
        }
      );

      return response.data;
    } catch (error) {
      console.error('PostEx order types fetch failed:', error.response?.data || error.message);
      throw new Error(`PostEx Order Types Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get available cities from PostEx
   * @returns {Promise<Array>} List of cities
   */
  async getCities(operationalCityType) {
    if (!this.isEnabled || !this.token) {
      throw new Error('PostEx service not properly configured');
    }

    try {
      const response = await this.http.get(
        `/v2/get-operational-city`,
        { timeout: 15000 }
      );

      const raw = response.data;
      // Debug keys once to understand tenant shape
      try {
        console.log('PostEx cities raw keys:', raw && typeof raw === 'object' ? Object.keys(raw) : typeof raw);
      } catch {}

      // Candidate arrays under common keys
      const candidates = [
        raw?.dist,              // PostEx often returns data under 'dist'
        raw?.data,
        raw?.cities,
        raw?.result,
        raw?.list,
        raw?.operationalCities,
        Array.isArray(raw) ? raw : null
      ].filter(Boolean);

      let arr = [];
      for (const cand of candidates) {
        if (Array.isArray(cand) && cand.length >= 0) { arr = cand; break; }
      }

      // As a last resort, search object values for the first array
      if (!arr.length && raw && typeof raw === 'object') {
        for (const v of Object.values(raw)) {
          if (Array.isArray(v)) { arr = v; break; }
        }
      }

      // Normalize each item to a common shape
      const norm = (arr || []).map((c) => {
        if (typeof c === 'string') {
          return {
            operationalCityName: c,
            countryName: undefined,
            isPickupCity: undefined,
            isDeliveryCity: undefined,
          };
        }
        if (c && typeof c === 'object') {
          return {
            operationalCityName: c.operationalCityName || c.cityName || c.name || c.CityName || null,
            countryName: c.countryName || c.CountryName || null,
            isPickupCity: typeof c.isPickupCity === 'boolean' ? c.isPickupCity : (c.pickup === true ? true : undefined),
            isDeliveryCity: typeof c.isDeliveryCity === 'boolean' ? c.isDeliveryCity : (c.delivery === true ? true : undefined),
          };
        }
        return { operationalCityName: String(c || ''), isPickupCity: undefined, isDeliveryCity: undefined };
      }).filter((c) => c.operationalCityName);

      return norm;
    } catch (error) {
      console.error('PostEx cities fetch failed:', error.response?.data || error.message);
      throw new Error(`PostEx Cities Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Transform your order data to PostEx format
   * @param {Object} order - Your order object
   * @returns {Object} PostEx formatted order
   */
  transformOrderToPostEx(order) {
    // Generate unique order reference number
    const orderRefNumber = `EM-${order.orderShortId || order._id.toString().slice(-8)}`;
    
    // Calculate invoice payment (total amount)
    const invoicePayment = order.totalPrice.toString();
    
    // Prepare order details
    const orderDetails = order.cartSummary.map(item => 
      `${item.title} x${item.count} - Rs.${item.price}`
    ).join(', ');

    // Format phone number for PostEx (should be 11 digits starting with 03)
    let customerPhone = order.shippingAddress.mobile;
    if (customerPhone.startsWith('+92')) {
      customerPhone = '0' + customerPhone.slice(3);
    } else if (customerPhone.startsWith('92')) {
      customerPhone = '0' + customerPhone.slice(2);
    }
    
    // Ensure phone is exactly 11 digits
    if (customerPhone.length !== 11 || !customerPhone.startsWith('03')) {
      throw new Error(`Invalid phone number format: ${customerPhone}. Must be 11 digits starting with 03.`);
    }

    // Get address codes from environment
    const pickupAddressCode = process.env.POSTEX_PICKUP_ADDRESS_CODE;
    const storeAddressCode = process.env.POSTEX_STORE_ADDRESS_CODE;

    // Ensure at least one address code is provided
    if (!pickupAddressCode && !storeAddressCode) {
      throw new Error('PostEx requires either POSTEX_PICKUP_ADDRESS_CODE or POSTEX_STORE_ADDRESS_CODE to be configured in environment variables');
    }

    const payload = {
      // Required fields
      orderRefNumber,
      invoicePayment,
      customerName: order.shippingAddress.fullName,
      customerPhone,
      deliveryAddress: order.shippingAddress.streetAddress,
      cityName: order.shippingAddress.city,
      invoiceDivision: 1, // Number: 1 = Single invoice, 2 = Split invoices
      items: order.cartSummary.length, 
      orderType: 'Normal', // String: Normal, Reverse, Replacement
      
      
      // Optional fields
      orderDetail: orderDetails.substring(0, 500), // Detail about order or product purchases
      transactionNotes: order.shippingAddress.additionalInstructions || 'Order from Etimad Mart' // Additional notes
    };

    // Add address codes only if they exist (at least one is required)
    if (pickupAddressCode) {
      payload.pickupAddressCode = pickupAddressCode;
    }
    if (storeAddressCode) {
      payload.storeAddressCode = storeAddressCode;
    }

    return payload;
  }

  /**
   * Validate PostEx configuration
   * @returns {Object} Configuration status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      configured: !!this.token,
      baseURL: this.baseURL
    };
  }
}

module.exports = new PostExService();
