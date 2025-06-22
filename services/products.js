const mysql = require('../config/db-mysql');
function normalize(str) {
  return str?.toLowerCase().replace(/\s+/g, '').trim();
}
function extractBHKNumbers(bhkInput) {
  if (!bhkInput || bhkInput === 'any') return [];
  if (Array.isArray(bhkInput)) return bhkInput.map(Number).filter(Boolean);
  const matches = bhkInput.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}
function generateSmartFallback(filters) {
  const tips = [];
  const bhks = extractBHKNumbers(filters.bhk);

  if (bhks.length) {
    const min = Math.min(...bhks);
    const max = Math.max(...bhks);
    tips.push(`try BHKs other than ${min}-${max}, like ${max + 1} or ${min - 1 > 0 ? min - 1 : 1}`);
  } else {
    tips.push(`mention BHK types like 2 BHK or 3 BHK`);
  }

  if (filters.location) {
    tips.push(`broaden the location beyond "${filters.location}"`);
  } else {
    tips.push(`add a location like Indirapuram or Vaishali`);
  }

  if (!filters.budget || filters.budget < 30000) {
    tips.push(`try increasing your budget beyond ₹${filters.budget || 30000}`);
  }

  if (filters.type) {
    tips.push(`try looking for both rent and sale options`);
  } else {
    tips.push(`mention whether you're looking to rent or buy`);
  }

  return ` Sorry, no matched your current filters.\n\ Suggestions to improve your search:\n` +
         tips.map(t => `• ${t}`).join('\n') +
         `\n\nJust let me know how you'd like to adjust! `;
}
function formatSuccess(rows) {
  return {
    results: rows.map(row => ({
      name: row.name,
      price: row.price,
      bhk: row.number_bedroom,
      type: row.type,
      location: row.locality || row.area || 'N/A',
      link: `URL${row.id}`
    })),
    message: null
  };
}
async function runQuery(filters) {
  let query = `
    DN_QUERY'
  `;
  const params = [];

  if (filters.type) {
    query += ` AND type = ?`;
    params.push(filters.type.toLowerCase());
  }

  if (filters.budget && Number(filters.budget) > 0) {
    query += ` AND price <= ?`;
    params.push(Number(filters.budget));
  }

  const bhks = extractBHKNumbers(filters.bhk);
  if (bhks.length) {
    query += ` AND number_bedroom IN (${bhks.map(() => '?').join(',')})`;
    params.push(...bhks);
  }

  if (filters.location) {
    const loc = normalize(filters.location);
    query += ` AND (LOWER(area) LIKE ? OR LOWER(locality) LIKE ? OR LOWER(location) LIKE ?)`;
    params.push(`%${loc}%`, `%${loc}%`, `%${loc}%`);
  }

  const [rows] = await db.query(query, params);
  return rows;
}

// 🚀 Public method: Search with fallback
async function searchProducts(originalFilters) {
  try {
    let filters = { ...originalFilters };
    let results = await runQuery(filters);

    if (!results.length) {
      console.log('🔁 No results found. Retrying with relaxed filters...');

      const try1 = { ...filters, budget: null };
      results = await runQuery(try1);
      if (results.length) return formatSuccess(results);

      const try2 = { ...try1, bhk: null };
      results = await runQuery(try2);
      if (results.length) return formatSuccess(results);

      const try3 = { ...try2, location: null };
      results = await runQuery(try3);
      if (results.length) return formatSuccess(results);

      return { results: [], message: generateSmartFallback(originalFilters) };
    }

    return formatSuccess(results);
  } catch (error) {
    console.error(' Error fetching from DB:', error);
    return {
      results: [],
      message: ' Something went wrong while fetching. Please try again later.'
    };
  }
}

module.exports = { searchProducts };
