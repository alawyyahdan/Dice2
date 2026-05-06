/**
 * Delay execution for specified milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Round number to 2 decimal places
 * @param {number} n
 * @returns {number}
 */
function roundTo2(n) {
  return Number(Number(n).toFixed(2));
}

module.exports = { sleep, roundTo2 };
