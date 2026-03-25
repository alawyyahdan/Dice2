const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
const requireAdmin = require('../middlewares/authMiddleware');

// GET /api/promotions/active - Public route for MiniApp and DiceCS
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    // find where isActive is true, and current date is between startDate and endDate
    const promotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ createdAt: -1 });
    res.json({ promotions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/promotions - Admin route to get all
router.get('/', requireAdmin, async (req, res) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 });
    res.json({ promotions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/promotions - Admin create
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, bannerUrl, description, startDate, endDate, isActive } = req.body;
    const newPromo = new Promotion({
      title,
      bannerUrl,
      description,
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true
    });
    const savedPromo = await newPromo.save();
    res.status(201).json({ message: 'Promotion created', promotion: savedPromo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/promotions/:id - Admin edit
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { title, bannerUrl, description, startDate, endDate, isActive } = req.body;
    const updatedPromo = await Promotion.findByIdAndUpdate(
      req.params.id,
      { title, bannerUrl, description, startDate, endDate, isActive, updatedAt: Date.now() },
      { new: true }
    );
    if (!updatedPromo) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ message: 'Promotion updated', promotion: updatedPromo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/promotions/:id - Admin delete
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deletedPromo = await Promotion.findByIdAndDelete(req.params.id);
    if (!deletedPromo) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ message: 'Promotion deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
