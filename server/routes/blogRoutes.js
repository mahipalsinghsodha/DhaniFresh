const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const auth = require('../middleware/auth');


// Public route to get all blogs (active only)
router.get('/', async (req, res) => {
  try {
    const blogs = await Blog.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin route to get all blogs (including inactive)
router.get('/admin', auth, auth.admin, async (req, res) => {
  try {
    const blogs = await Blog.find({}).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public route to get single blog by slug
router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, isActive: true });
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin route to create a blog
router.post('/', auth, auth.admin, async (req, res) => {
  try {
    const { title, slug, content, images, author, isActive, tags } = req.body;
    
    // Check if slug exists
    const existing = await Blog.findOne({ slug });
    if (existing) return res.status(400).json({ message: 'Slug already exists. Please choose a different title/slug.' });

    const blog = new Blog({
      title,
      slug,
      content,
      images: images || [],
      author: author || 'Daatasa Team',
      isActive: isActive !== undefined ? isActive : true,
      tags: tags || []
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin route to update a blog
router.put('/:id', auth, auth.admin, async (req, res) => {
  try {
    const { title, slug, content, images, author, isActive, tags } = req.body;
    
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    if (slug && slug !== blog.slug) {
      const existing = await Blog.findOne({ slug });
      if (existing) return res.status(400).json({ message: 'Slug already exists.' });
      blog.slug = slug;
    }

    if (title) blog.title = title;
    if (content) blog.content = content;
    if (images) blog.images = images;
    if (author) blog.author = author;
    if (isActive !== undefined) blog.isActive = isActive;
    if (tags) blog.tags = tags;

    await blog.save();
    res.json(blog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin route to delete a blog
router.delete('/:id', auth, auth.admin, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    await blog.deleteOne();
    res.json({ message: 'Blog deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
