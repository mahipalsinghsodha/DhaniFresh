const express = require('express');
const router = express.Router();
const { getCache, setCache } = require('../utils/cache');

// Proxy pincode lookup to avoid CORS issues and cache upstream results
// GET /api/pincode/:code
router.get('/:code', async (req, res) => {
  const { code } = req.params;

  // Basic validation
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Invalid PIN code format' });
  }

  const cacheKey = `pincode:${code}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // Use built-in fetch (Node 18+) with 5s timeout
    const upstream = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!upstream.ok) {
      return res.status(502).json({ message: 'Upstream pincode service unavailable' });
    }

    const data = await upstream.json();
    if (data && Array.isArray(data) && data[0]?.Status === 'Success') {
      await setCache(cacheKey, data, 86400 * 7); // Cache valid responses for 7 days
    }
    res.json(data);
  } catch (err) {
    console.error('Pincode proxy error:', err.message);
    res.status(502).json({ message: 'Could not fetch pincode data. Please fill manually.' });
  }
});

module.exports = router;
