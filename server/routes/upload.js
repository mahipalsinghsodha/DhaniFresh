const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const auth = require('../middleware/auth');
const { logAction } = require('../utils/logger');

// ── Configure Cloudinary ──
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Use memory storage — we stream the buffer directly to Cloudinary ──
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Helper: stream buffer to Cloudinary and return the result
const streamUpload = (buffer, options) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (result) resolve(result);
            else reject(error);
        });
        streamifier.createReadStream(buffer).pipe(stream);
    });

// POST /api/upload (admin only)
router.post('/', auth, auth.admin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const result = await streamUpload(req.file.buffer, {
            folder: 'products',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        });

        await logAction(req, 'UPLOAD_IMAGE', 'FILE', null, {
            filename: req.file.originalname,
            url: result.secure_url.slice(-40),
        });

        res.json({ url: result.secure_url });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message || 'Image upload failed' });
    }
});

// Multer for Return Proofs: Images (up to 10MB) & Videos (up to 40MB)
const uploadProof = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowed = [
            'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
            'video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/x-matroska'
        ];
        if (allowed.includes(file.mimetype.toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Only images (JPG, PNG, WebP) and videos (MP4, WebM, MOV) are allowed'), false);
        }
    },
    limits: { fileSize: 40 * 1024 * 1024 }, // 40 MB max for unboxing / defect videos
});

// POST /api/upload/chat (open — no auth required for guest chat support)
router.post('/chat', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const result = await streamUpload(req.file.buffer, {
            folder: 'chat',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        });

        res.json({ url: result.secure_url });
    } catch (error) {
        console.error('Chat upload error:', error);
        res.status(500).json({ message: error.message || 'Image upload failed' });
    }
});

// POST /api/upload/return-proof/single (Authenticated user uploads one proof photo or video)
router.post('/return-proof/single', auth, (req, res, next) => {
    uploadProof.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || 'Upload validation failed' });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const isVideo = req.file.mimetype.startsWith('video/');
        const options = {
            folder: isVideo ? 'returns/videos' : 'returns/images',
            resource_type: isVideo ? 'video' : 'image',
            ...(isVideo ? {} : { transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }] })
        };

        const result = await streamUpload(req.file.buffer, options);
        res.json({ url: result.secure_url, isVideo });
    } catch (error) {
        console.error('Return proof single upload error:', error);
        res.status(500).json({ message: error.message || 'Upload failed' });
    }
});

// ── Media Library Routes ──

// GET /api/upload/images (admin only) - Fetch all images from 'products' folder
router.get('/images', auth, auth.admin, async (req, res) => {
    try {
        const { next_cursor } = req.query;
        // Search for all resources in the 'products' folder
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'products/', // fetch images starting with this prefix
            max_results: 50,
            direction: 'desc',
            next_cursor: next_cursor || null
        });

        res.json({
            images: result.resources,
            next_cursor: result.next_cursor
        });
    } catch (error) {
        console.error('Fetch images error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch images' });
    }
});

// POST /api/upload/bulk (admin only) - Upload multiple images
router.post('/bulk', auth, auth.admin, upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const uploadPromises = req.files.map(file => 
            streamUpload(file.buffer, {
                folder: 'products',
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
                transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
            })
        );

        const results = await Promise.all(uploadPromises);
        
        await logAction(req, 'UPLOAD_IMAGE_BULK', 'FILE', null, {
            count: req.files.length
        });

        const urls = results.map(r => ({ url: r.secure_url, public_id: r.public_id }));
        res.json({ urls });
    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ message: error.message || 'Bulk upload failed' });
    }
});

// DELETE /api/upload/images (admin only) - Delete an image by public_id
router.delete('/images', auth, auth.admin, async (req, res) => {
    try {
        const { public_id } = req.body;
        if (!public_id) {
            return res.status(400).json({ message: 'public_id is required' });
        }
        
        const result = await cloudinary.uploader.destroy(public_id);
        
        await logAction(req, 'DELETE_IMAGE', 'FILE', null, { public_id });
        
        res.json({ result });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ message: error.message || 'Failed to delete image' });
    }
});

module.exports = router;