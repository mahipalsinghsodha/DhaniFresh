const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminController = require('../controllers/adminController');

/**
 * All routes in this file require at least Admin access
 */

// Analytics — accessible by admin + superadmin
router.get('/analytics', auth, auth.admin, adminController.getAnalytics);

// Basic Admin List (Super Admin only for management)
router.get('/admins', auth, auth.superadmin, adminController.getAllAdmins);

// Admin Action Logs
router.get('/logs', auth, auth.superadmin, adminController.getActivityLogs);

// Admin Management
router.post('/create-admin', auth, auth.superadmin, adminController.createAdmin);
router.patch('/update-access/:id', auth, auth.superadmin, adminController.updateAdminPermissions);
router.delete('/:id', auth, auth.superadmin, adminController.deleteAdmin);

// Support Agent Management
router.get('/support-agents', auth, auth.superadmin, adminController.getSupportAgents);
router.post('/create-support-agent', auth, auth.superadmin, adminController.createSupportAgent);
router.delete('/support-agent/:id', auth, auth.superadmin, adminController.deleteAdmin);
router.get('/support-agent/:agentId/history', auth, auth.superadmin, adminController.getAgentRejectionHistory);
router.post('/support-agent/:id/reset-stats', auth, auth.superadmin, adminController.resetSupportAgentStats);

// Return Requests (Admin+orders)
router.get('/return-requests', auth, auth.admin, auth.hasPermission('orders'), adminController.getReturnRequests);
router.put('/return-requests/:id', auth, auth.admin, auth.hasPermission('orders'), adminController.approveReturnRequest);

module.exports = router;

