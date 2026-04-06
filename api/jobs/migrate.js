/**
 * DB Migration / Backfill Script — COMPREHENSIVE VERSION
 *
 * Dijalankan otomatis setiap kali API start-up.
 * Mengisi SEMUA field yang missing di dokumen lama berdasarkan schema Mongoose.
 *
 * Cara kerja:
 * 1. Buat "dokumen template" baru dari schema (semua default otomatis terisi)
 * 2. Bandingkan dengan dokumen yang ada di DB
 * 3. Set field yang missing ke nilai default-nya
 *
 * Idempotent: aman dijalankan berkali-kali, tidak mengubah data yang sudah ada.
 */

const Setting = require('../models/Setting');
const Ticket = require('../models/Ticket');

/**
 * Flatten nested object jadi dot-notation paths
 * Contoh: { a: { b: 1 } } → { 'a.b': 1 }
 */
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      const nested = flattenObject(val, fullKey);
      Object.assign(result, nested);
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

/**
 * Get nilai dari nested object berdasarkan dot-notation path
 * Contoh: getNestedValue({ a: { b: 1 } }, 'a.b') → 1
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

async function runMigrations() {
  console.log('[Migration] 🔄 Menjalankan database schema migration...');
  
  try {
    // =========================================================
    // 1. SETTING — Auto-detect dari schema & backfill yang missing
    // =========================================================
    let settingDoc = await Setting.findOne({ configurationKey: 'global_settings' });

    if (!settingDoc) {
      // Belum ada setting sama sekali — buat baru dengan semua default
      settingDoc = await Setting.create({ configurationKey: 'global_settings' });
      console.log('[Migration] ✅ Setting global dibuat baru dengan semua default.');
    } else {
      // Buat "template" dokumen baru untuk dapat semua nilai default dari schema
      const templateDoc = new Setting({ configurationKey: 'global_settings_template' });
      const templateObj = templateDoc.toObject({ versionKey: false });
      // Hapus field internal
      delete templateObj._id;
      delete templateObj.configurationKey;

      // Flatten dua-duanya untuk perbandingan mudah
      const templateFlat = flattenObject(templateObj);
      const existingObj = settingDoc.toObject({ versionKey: false });
      const existingFlat = flattenObject(existingObj);

      const patchSet = {};
      let missingFields = [];

      for (const [dotPath, defaultVal] of Object.entries(templateFlat)) {
        const existingVal = getNestedValue(existingObj, dotPath);
        if (existingVal === undefined || existingVal === null) {
          // Skip field yang berupa array besar (depositPromos, banks, methods) = data user
          if (dotPath.includes('depositPromos') || dotPath.includes('banks') || dotPath.includes('methods')) {
            continue;
          }
          patchSet[dotPath] = defaultVal;
          missingFields.push(dotPath);
        }
      }

      if (Object.keys(patchSet).length > 0) {
        await Setting.updateOne(
          { configurationKey: 'global_settings' },
          { $set: patchSet }
        );
        console.log(`[Migration] ✅ Setting: ${missingFields.length} field yang hilang dibackfill:`);
        console.log(`            ${missingFields.join(', ')}`);
      } else {
        console.log('[Migration] ✅ Setting: Semua field sudah lengkap.');
      }
    }

    // =========================================================
    // 2. TICKETS — Backfill field-field baru Mongoose
    // =========================================================
    const ticketTemplate = new Ticket({
      referenceId: 'TEMP',
      telegramId: '0',
    });
    const ticketTemplatObj = ticketTemplate.toObject({ versionKey: false });
    const ticketFlat = flattenObject(ticketTemplatObj);

    let ticketPatch = {};
    for (const [dotPath, defaultVal] of Object.entries(ticketFlat)) {
      // Field yang harus dibackfill (bukan dinamic per-tiket)
      const backfillableFields = ['adminNotified', 'status'];
      const fieldName = dotPath.split('.').pop();
      if (backfillableFields.includes(fieldName)) {
        const existsCheck = {};
        existsCheck[dotPath] = { $exists: false };
        const count = await Ticket.countDocuments(existsCheck);
        if (count > 0) {
          const setOp = {};
          setOp[dotPath] = defaultVal;
          const result = await Ticket.updateMany(existsCheck, { $set: setOp });
          console.log(`[Migration] ✅ Ticket: ${result.modifiedCount} dokumen diupdate (${dotPath} = ${defaultVal})`);
        }
      }
    }

    // =========================================================
    // 3. PROMO PAYMENT — Backfill turnoverMultiplier di promo lama
    // =========================================================
    const settingRefresh = await Setting.findOne({ configurationKey: 'global_settings' });
    const promos = settingRefresh?.paymentGateway?.depositPromos || [];
    let promoFixed = false;

    const fixedPromos = promos.map(p => {
      const pObj = p.toObject ? p.toObject() : { ...p };
      let changed = false;
      if (pObj.turnoverMultiplier === undefined || pObj.turnoverMultiplier === null) {
        pObj.turnoverMultiplier = 1;
        changed = true;
      }
      if (pObj.type === undefined) {
        pObj.type = 'percent';
        changed = true;
      }
      if (pObj.bonusValue === undefined) {
        pObj.bonusValue = 0;
        changed = true;
      }
      if (changed) promoFixed = true;
      return pObj;
    });

    if (promoFixed) {
      await Setting.updateOne(
        { configurationKey: 'global_settings' },
        { $set: { 'paymentGateway.depositPromos': fixedPromos } }
      );
      console.log('[Migration] ✅ Deposit Promos lama diperbarui (turnoverMultiplier, type, bonusValue).');
    } else {
      console.log('[Migration] ✅ Deposit Promos: Semua promo sudah memiliki field lengkap.');
    }

    console.log('[Migration] 🟢 Migration selesai!');
  } catch (err) {
    // Jangan crash server, cukup log error
    console.error('[Migration] ❌ Error saat migrasi:', err.message);
  }
}

module.exports = runMigrations;
