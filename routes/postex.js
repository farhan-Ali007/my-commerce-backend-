const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const postexService = require('../services/postexService');
const { isAdmin, isAuthorized } = require('../middlewares/auth');

/**
 * Push order to PostEx
 * POST /api/postex/push-order/:orderId
 */
router.post('/push-order/:orderId', isAuthorized, isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    // Check if already pushed to PostEx
    if (order.shippingProvider?.provider === 'postex' && order.shippingProvider?.pushed) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order already pushed to PostEx',
        orderRefNumber: order.shippingProvider.orderRefNumber
      });
    }

    // Validate required fields
    if (!order.shippingAddress?.mobile || !order.shippingAddress?.city) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order missing required shipping information (mobile/city)' 
      });
    }

    // Push to PostEx
    const postexResponse = await postexService.createOrder(order);
    
    // Update order with PostEx information
    const updateData = {
      'shippingProvider.provider': 'postex',
      'shippingProvider.pushed': true,
      'shippingProvider.pushedAt': new Date(),
      'shippingProvider.orderRefNumber': postexResponse.orderRefNumber || `EM-${order.orderShortId}`,
      'shippingProvider.extra': postexResponse
    };

    if (postexResponse.orderId) {
      updateData['shippingProvider.postexOrderId'] = postexResponse.orderId;
    }

    // Handle different possible tracking number field names and nested structures
    const trackingNumber = postexResponse.trackingNumber || 
                          postexResponse.cn || 
                          postexResponse.consignmentNumber ||
                          postexResponse.cnNumber ||
                          postexResponse.dist?.trackingNumber; // PostEx returns tracking number in dist object
    
    if (trackingNumber) {
      updateData['shippingProvider.trackingNumber'] = trackingNumber;
    }

    await Order.findByIdAndUpdate(orderId, updateData);

    res.json({
      success: true,
      message: 'Order successfully pushed to PostEx',
      data: {
        orderRefNumber: postexResponse.orderRefNumber,
        postexOrderId: postexResponse.orderId,
        trackingNumber: trackingNumber
      }
    });

  } catch (error) {
    console.error('PostEx push order error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to push order to PostEx' 
    });
  }
});

/**
 * Track order in PostEx by CN
 * GET /api/postex/track-by-cn/:cn
 */
router.get('/track-by-cn/:cn', isAuthorized, isAdmin, async (req, res) => {
  try {
    const { cn } = req.params;

    if (!cn) {
      return res.status(400).json({
        success: false,
        message: 'Tracking number is required'
      });
    }

    const trackingData = await postexService.getOrderStatus(cn);

    res.json({
      success: true,
      data: trackingData
    });

  } catch (error) {
    console.error('PostEx track by CN error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to track order by CN'
    });
  }
});
router.get('/track/:orderId', isAuthorized, isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    if (!order.shippingProvider?.orderRefNumber || !order.shippingProvider?.trackingNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order not pushed to PostEx yet or tracking number not available' 
      });
    }

    const trackingData = await postexService.getOrderStatus(order.shippingProvider.trackingNumber);
    
    // Update order with latest status
    if (trackingData.status) {
      await Order.findByIdAndUpdate(orderId, {
        'shippingProvider.status': trackingData.status,
        'shippingProvider.lastStatusUpdate': new Date()
      });
    }

    res.json({
      success: true,
      data: trackingData
    });

  } catch (error) {
    console.error('PostEx tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to track order' 
    });
  }
});

/**
 * Cancel order in PostEx
 * POST /api/postex/cancel/:orderId
 */
router.post('/cancel/:orderId', isAuthorized, isAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    if (!order.shippingProvider?.trackingNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order not pushed to PostEx yet or tracking number missing' 
      });
    }

    const cancelResponse = await postexService.cancelOrder(order.shippingProvider.trackingNumber);
    
    // Update order status
    await Order.findByIdAndUpdate(orderId, {
      'status': 'Cancelled',
      'shippingProvider.status': 'Cancelled',
      'shippingProvider.lastStatusUpdate': new Date()
    });

    res.json({
      success: true,
      message: 'Order cancelled in PostEx',
      data: cancelResponse
    });

  } catch (error) {
    console.error('PostEx cancel error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to cancel order' 
    });
  }
});


/**
 * Get PostEx order types
 * GET /api/postex/order-types
 */
router.get('/order-types', isAuthorized, isAdmin, async (req, res) => {
  try {
    const orderTypes = await postexService.getOrderTypes();
    
    res.json({
      success: true,
      data: orderTypes
    });

  } catch (error) {
    console.error('PostEx order types error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch order types' 
    });
  }
});

/**
 * Get PostEx cities
 * GET /api/postex/cities
 */
router.get('/cities', isAuthorized, isAdmin, async (req, res) => {
  try {
    const qType = String(req.query?.operationalCityType || '').toLowerCase();
    // Always fetch ALL cities from PostEx (no enum param) to avoid tenant enum mismatch errors
    const cities = await postexService.getCities();
    const list = Array.isArray(cities) ? cities : [];

    let filtered = list;
    if (qType === 'pickup') {
      filtered = list.filter((c) => c?.isPickupCity === true);
    } else if (qType === 'delivery') {
      filtered = list.filter((c) => c?.isDeliveryCity === true);
    }

    res.json({
      success: true,
      data: filtered
    });

  } catch (error) {
    console.error('PostEx cities error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch cities' 
    });
  }
});

/**
 * Get PostEx service status
 * GET /api/postex/status
 */
router.get('/status', isAuthorized, isAdmin, (req, res) => {
  const status = postexService.getStatus();
  
  res.json({
    success: true,
    data: status
  });
});

/**
 * Bulk push orders to PostEx
 * POST /api/postex/bulk-push
 */
router.post('/bulk-push', isAuthorized, isAdmin, async (req, res) => {
  try {
    const { orderIds } = req.body;
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of order IDs' 
      });
    }

    const results = [];
    
    for (const orderId of orderIds) {
      try {
        const order = await Order.findById(orderId);
        if (!order) {
          results.push({ orderId, success: false, error: 'Order not found' });
          continue;
        }

        // Skip if already pushed
        if (order.shippingProvider?.provider === 'postex' && order.shippingProvider?.pushed) {
          results.push({ 
            orderId, 
            success: false, 
            error: 'Already pushed to PostEx',
            orderRefNumber: order.shippingProvider.orderRefNumber 
          });
          continue;
        }

        // Push to PostEx
        const postexResponse = await postexService.createOrder(order);
        
        // Handle different possible tracking number field names and nested structures
        const trackingNumber = postexResponse.trackingNumber || 
                              postexResponse.cn || 
                              postexResponse.consignmentNumber ||
                              postexResponse.cnNumber ||
                              postexResponse.dist?.trackingNumber; // PostEx returns tracking number in dist object

        // Update order
        const bulkUpdateData = {
          'shippingProvider.provider': 'postex',
          'shippingProvider.pushed': true,
          'shippingProvider.pushedAt': new Date(),
          'shippingProvider.orderRefNumber': postexResponse.orderRefNumber || `EM-${order.orderShortId}`,
          'shippingProvider.extra': postexResponse
        };

        if (postexResponse.orderId) {
          bulkUpdateData['shippingProvider.postexOrderId'] = postexResponse.orderId;
        }

        if (trackingNumber) {
          bulkUpdateData['shippingProvider.trackingNumber'] = trackingNumber;
        }

        await Order.findByIdAndUpdate(orderId, bulkUpdateData);

        results.push({ 
          orderId, 
          success: true, 
          orderRefNumber: postexResponse.orderRefNumber,
          trackingNumber: trackingNumber
        });

      } catch (error) {
        results.push({ 
          orderId, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Processed ${orderIds.length} orders. ${successCount} successful, ${failCount} failed.`,
      results
    });

  } catch (error) {
    console.error('PostEx bulk push error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process bulk push' 
    });
  }
});

module.exports = router;
