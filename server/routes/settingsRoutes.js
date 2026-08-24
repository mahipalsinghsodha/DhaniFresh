const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const { sendAdminOtpEmail } = require('../services/emailService');
const { getCache, setCache, deleteCache } = require('../utils/cache');

// ── GET /api/settings  (PUBLIC — frontend reads this to display GST, shipping, site status, company info)
router.get('/', async (req, res) => {
  try {
    const cached = await getCache('settings:public');
    if (cached) return res.json(cached);

    const settings = await Settings.getGlobal();
    // Only expose safe, public fields — DO NOT expose security/2FA settings to the public
    const publicData = {
      gstRate: settings.gstEnabled ? settings.gstRate : 0,
      gstEnabled: settings.gstEnabled,
      freeShippingThreshold: settings.freeShippingThreshold,
      shippingCharge: settings.shippingCharge,
      serviceablePincodes: settings.serviceablePincodes || [],
      isMaintenanceMode: settings.isMaintenanceMode,
      isComingSoon: settings.isComingSoon,
      comingSoonLaunchDate: settings.comingSoonLaunchDate,
      companyDetails: settings.companyDetails || { name: '', email: '', address: '', gstin: '' },
      supportSchedule: settings.supportSchedule || {}
    };
    await setCache('settings:public', publicData, 300); // 5-minute cache
    res.json(publicData);
  } catch (error) {
    console.error('Settings GET error:', error);
    res.status(500).json({ message: 'Failed to load settings' });
  }
});

// ── GET /api/settings/admin (ADMIN ONLY — fetch full settings with masked security info) ──
router.get('/admin', auth, auth.admin, async (req, res) => {
  try {
    const settings = await Settings.getGlobal();
    
    // Mask email for display in Admin UI (e.g., ms***10@gmail.com)
    let maskedEmail = '';
    const email = settings.security?.otpEmail || '';
    if (email.includes('@')) {
      const [userPart, domain] = email.split('@');
      maskedEmail = userPart.length > 3
        ? `${userPart.slice(0, 2)}***${userPart.slice(-2)}@${domain}`
        : `${userPart[0]}***@${domain}`;
    }

    res.json({
      gstRate: settings.gstRate,
      gstEnabled: settings.gstEnabled,
      freeShippingThreshold: settings.freeShippingThreshold,
      shippingCharge: settings.shippingCharge,
      serviceablePincodes: settings.serviceablePincodes || [],
      isMaintenanceMode: settings.isMaintenanceMode,
      isComingSoon: settings.isComingSoon,
      comingSoonLaunchDate: settings.comingSoonLaunchDate,
      security: {
        twoFactorEnabled: Boolean(settings.security?.twoFactorEnabled),
        maskedEmail: maskedEmail
      },
      companyDetails: settings.companyDetails || { name: '', email: '', address: '', gstin: '' },
      supportSchedule: settings.supportSchedule || {}
    });
  } catch (error) {
    console.error('Admin Settings GET error:', error);
    res.status(500).json({ message: 'Failed to load admin settings' });
  }
});

// ── POST /api/settings/send-otp (Generate & Send OTP to DB configured Admin Email) ──
router.post('/send-otp', auth, auth.admin, async (req, res) => {
  try {
    const settings = await Settings.findOne({ _id: 'global' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await Settings.updateOne(
      { _id: 'global' },
      { $set: { adminOtpHash: hash, adminOtpExpires: expires } }
    );

    const targetEmail = settings?.security?.otpEmail || req.user.email;
    await sendAdminOtpEmail({
      to: targetEmail,
      adminName: req.user.name,
      otp,
    });

    console.log(`[ADMIN 2FA] OTP generated and sent to: ${targetEmail}`);

    // Mask email for display in modal (e.g., ms***10@gmail.com)
    let maskedEmail = targetEmail;
    if (targetEmail.includes('@')) {
      const [userPart, domain] = targetEmail.split('@');
      maskedEmail = userPart.length > 3
        ? `${userPart.slice(0, 2)}***${userPart.slice(-2)}@${domain}`
        : `${userPart[0]}***@${domain}`;
    }

    res.json({ 
      message: `OTP sent to registered admin email (${maskedEmail})`,
      sentTo: maskedEmail
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// ── PATCH /api/settings  (ADMIN ONLY — update GST, shipping, pincodes, site status, invoice details)
router.patch('/', auth, auth.admin, async (req, res) => {
  try {
    const currentSettings = await Settings.findOne({ _id: 'global' }).select('+adminOtpHash +adminOtpExpires');

    // If 2FA is active in DB, enforce OTP verification
    if (currentSettings?.security?.twoFactorEnabled) {
      const otp = req.body.otp;
      if (!otp) {
        return res.status(403).json({ message: 'OTP verification is required to update settings.' });
      }
      if (!currentSettings?.adminOtpHash || !currentSettings?.adminOtpExpires || currentSettings.adminOtpExpires < new Date()) {
        return res.status(400).json({ message: 'OTP has expired or is invalid. Please request a new one.' });
      }
      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
      if (hashedOtp !== currentSettings.adminOtpHash) {
        return res.status(400).json({ message: 'Invalid OTP. Please enter the correct code.' });
      }
      // Consume the OTP so it can't be reused
      await Settings.updateOne({ _id: 'global' }, { $unset: { adminOtpHash: "", adminOtpExpires: "" } });
    }

    const { 
      gstRate, gstEnabled, freeShippingThreshold, shippingCharge, serviceablePincodes,
      isMaintenanceMode, isComingSoon, comingSoonLaunchDate, companyDetails, supportSchedule
    } = req.body;

    // Validate
    if (gstRate !== undefined) {
      const rate = Number(gstRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ message: 'GST rate must be between 0 and 100' });
      }
    }
    if (freeShippingThreshold !== undefined && Number(freeShippingThreshold) < 0) {
      return res.status(400).json({ message: 'Free shipping threshold cannot be negative' });
    }
    if (shippingCharge !== undefined && Number(shippingCharge) < 0) {
      return res.status(400).json({ message: 'Shipping charge cannot be negative' });
    }

    const update = { updatedBy: req.user._id };
    if (gstRate !== undefined)               update.gstRate = Number(gstRate);
    if (gstEnabled !== undefined)            update.gstEnabled = Boolean(gstEnabled);
    if (freeShippingThreshold !== undefined) update.freeShippingThreshold = Number(freeShippingThreshold);
    if (shippingCharge !== undefined)        update.shippingCharge = Number(shippingCharge);
    if (serviceablePincodes !== undefined) {
      if (!Array.isArray(serviceablePincodes)) return res.status(400).json({ message: 'serviceablePincodes must be an array' });
      update.serviceablePincodes = serviceablePincodes;
    }
    if (isMaintenanceMode !== undefined)     update.isMaintenanceMode = Boolean(isMaintenanceMode);
    if (isComingSoon !== undefined)          update.isComingSoon = Boolean(isComingSoon);
    if (comingSoonLaunchDate !== undefined) {
      update.comingSoonLaunchDate = comingSoonLaunchDate ? new Date(comingSoonLaunchDate) : null;
    }
    if (companyDetails !== undefined) {
      update.companyDetails = {
        name: companyDetails.name || '',
        email: companyDetails.email || '',
        address: companyDetails.address || '',
        gstin: companyDetails.gstin || ''
      };
    }
    if (supportSchedule !== undefined) {
      update.supportSchedule = {
        enabled: supportSchedule.enabled !== false,
        workDays: Array.isArray(supportSchedule.workDays) ? supportSchedule.workDays : [1, 2, 3, 4, 5, 6],
        startHour: supportSchedule.startHour || '09:00',
        endHour: supportSchedule.endHour || '20:00',
        timezone: supportSchedule.timezone || 'Asia/Kolkata',
        maxConcurrentChats: Number(supportSchedule.maxConcurrentChats) || 3,
        ringTimeoutSeconds: Number(supportSchedule.ringTimeoutSeconds) || 30,
        offlineMessage: supportSchedule.offlineMessage || 'Our live support team is currently offline or closed for Sunday. Please submit a support ticket.',
      };
    }

    const settings = await Settings.findByIdAndUpdate(
      'global',
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    // Invalidate public settings cache
    await deleteCache('settings:public');

    res.json({
      message: 'Settings updated successfully',
      settings: {
        gstRate: settings.gstRate,
        gstEnabled: settings.gstEnabled,
        freeShippingThreshold: settings.freeShippingThreshold,
        shippingCharge: settings.shippingCharge,
        serviceablePincodes: settings.serviceablePincodes,
        isMaintenanceMode: settings.isMaintenanceMode,
        isComingSoon: settings.isComingSoon,
        comingSoonLaunchDate: settings.comingSoonLaunchDate,
        companyDetails: settings.companyDetails,
        supportSchedule: settings.supportSchedule,
      },
    });
  } catch (error) {
    console.error('Settings PATCH error:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

// ── GET /api/settings/pincode/:zip  (PUBLIC — check if a pincode is serviceable)
router.get('/pincode/:zip', async (req, res) => {
  try {
    const settings = await Settings.getGlobal();
    const zip = req.params.zip?.trim();
    
    if (!settings.serviceablePincodes || settings.serviceablePincodes.length === 0) {
      // Empty array means ALL pincodes are serviceable
      return res.json({ serviceable: true });
    }
    
    const isServiceable = settings.serviceablePincodes.includes(zip);
    res.json({ serviceable: isServiceable });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check pincode' });
  }
});

module.exports = router;
