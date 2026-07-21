const crypto = require('crypto');

function generateOrderNo() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const random = crypto.randomInt(1000, 9999);
  return `JLJ${dateStr}${random}`;
}

module.exports = { generateOrderNo };