const { createCanvas, registerFont } = require('canvas');
const Bet = require('../../api/models/Bet');
const fs = require('fs');
const path = require('path');

// Use absolute path resolve to guarantee font is found regardless of cwd
const fontPath = path.resolve(__dirname, '..', 'assets', 'Roboto-Bold.ttf');
if (fs.existsSync(fontPath)) {
  registerFont(fontPath, { family: 'Roboto' });
  console.log('[TrendGenerator] Font Roboto loaded from:', fontPath);
} else {
  console.warn('[TrendGenerator] Font not found at:', fontPath, '- text may render as boxes!');
}

async function generateTrendImage(filter) {
  // Fetch last 15 unique rounds for this filter that are resolved
  const recentBets = await Bet.aggregate([
    { $match: { diceResult: { $ne: [] }, ...filter } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$roundId",
        diceResult: { $first: "$diceResult" },
        diceTotal: { $first: "$diceTotal" },
        createdAt: { $first: "$createdAt" }
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 15 }
  ]);

  // If no data, return null
  if (!recentBets || recentBets.length === 0) return null;

  // The canvas width and height parameters
  const width = 800;
  const rowHeight = 40;
  const padding = 20;
  const height = (recentBets.length + 1) * rowHeight + padding * 2; // +1 for header

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Headers
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 20px Roboto, Arial, sans-serif';
  ctx.fillText('No:', 40, padding + 25);
  ctx.fillText('Hasil:', 300, padding + 25);

  let y = padding + rowHeight + 25;

  const { getMatchingCategories } = require('./diceCalculator');

  for (const round of recentBets) {
    // Round ID
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Roboto, Arial, sans-serif';
    ctx.fillText(round._id, 40, y);

    // Dice Circles and Equation
    const [d1, d2, d3] = round.diceResult;
    let x = 250;

    // Helper to draw a dice circle
    const drawDice = (val, currentX) => {
      ctx.beginPath();
      ctx.arc(currentX + 12, y - 6, 16, 0, Math.PI * 2);
      ctx.strokeStyle = '#00a8ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16px Roboto, Arial, sans-serif';
      ctx.fillText(val, currentX + 7, y);
      return currentX + 30;
    };

    x = drawDice(d1, x);
    ctx.fillStyle = '#000000';
    ctx.fillText('+', x + 5, y);
    x += 25;
    
    x = drawDice(d2, x);
    ctx.fillStyle = '#000000';
    ctx.fillText('+', x + 5, y);
    x += 25;

    x = drawDice(d3, x);
    ctx.fillStyle = '#000000';
    ctx.fillText(`= ${round.diceTotal}`, x + 10, y);

    // Categories
    const categories = getMatchingCategories(round.diceResult);
    // Draw Category boxes
    let catX = 480;
    const catBgColor = '#e0e0e0';

    ctx.font = 'bold 16px Roboto, Arial, sans-serif';
    // Let's filter some key categories for the trend overview if there are too many
    // Usually we show: [Besar/Kecil], [Ganjil/Genap], [Naga/Harimau/Seri], [Lurus/Pasangan/Tiga Berbeda/Triple]
    const displayCat = [];
    if (categories.includes('Triple')) displayCat.push({text: 'T', color: '#e74c3c'});
    else {
      if (categories.includes('Besar')) displayCat.push({text: 'B', color: '#27ae60'});
      if (categories.includes('Kecil')) displayCat.push({text: 'K', color: '#e74c3c'});
      if (categories.includes('Ganjil')) displayCat.push({text: 'GA', color: '#27ae60'});
      if (categories.includes('Genap')) displayCat.push({text: 'GE', color: '#e74c3c'});
      if (categories.includes('Naga')) displayCat.push({text: 'N', color: '#e74c3c'});
      if (categories.includes('Harimau')) displayCat.push({text: 'H', color: '#27ae60'});
      if (categories.includes('Seri')) displayCat.push({text: 'S', color: '#2980b9'});
      
      if (categories.includes('Lurus')) displayCat.push({text: 'L', color: '#27ae60'});
      if (categories.includes('Pasangan')) displayCat.push({text: 'P', color: '#2980b9'});
      if (categories.includes('Tiga Berbeda')) displayCat.push({text: 'TB', color: '#7f8c8d'});
    }

    // Draw gray background box for all categories
    // Calculate total width needed
    let totalCatWidth = displayCat.length * 40;
    ctx.fillStyle = catBgColor;
    ctx.fillRect(catX, y - 20, totalCatWidth, 24);

    for (const cat of displayCat) {
      ctx.fillStyle = cat.color;
      // Center the text in its 40px slot
      const textWidth = ctx.measureText(cat.text).width;
      const textOffsetX = catX + (40 - textWidth) / 2;
      ctx.fillText(cat.text, textOffsetX, y - 3);
      catX += 40;
    }

    y += rowHeight;
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateTrendImage };
