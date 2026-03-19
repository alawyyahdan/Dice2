const express = require('express');
const router = express.Router();
const Angpao = require('../models/Angpao');
const auth = require('../middlewares/authMiddleware');

// GET /api/angpao?page=1&limit=20&search=xxx
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { angpaoId: new RegExp(search, 'i') },
        { creatorName: new RegExp(search, 'i') },
        { creatorTelegramId: new RegExp(search, 'i') }
      ];
    }

    const total = await Angpao.countDocuments(query);
    const angpaos = await Angpao.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Stats
    const allAngpaos = await Angpao.find();
    const stats = {
      totalValue: allAngpaos.reduce((s, a) => s + (a.totalAmount || 0), 0),
      totalCount: allAngpaos.length
    };

    res.json({ angpaos, total, page: Number(page), stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/angpao/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const angpao = await Angpao.findByIdAndDelete(req.params.id);
    if (!angpao) return res.status(404).json({ error: 'Angpao tidak ditemukan' });
    res.json({ message: 'Angpao berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
