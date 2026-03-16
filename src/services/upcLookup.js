/**
 * UPC Lookup Service — Arnett Family App
 *
 * Lookup chain (in order):
 * 1. Open Food Facts      — grocery, branded food
 * 2. Open Beauty Facts    — personal care, cosmetics
 * 3. Open Pet Food Facts  — pet food and supplies
 * 4. Open Products Facts  — household, cleaning, general
 * 5. USDA FoodData Central — nutritional data, generic foods
 * 6. UPC Item DB          — general merchandise fallback
 */

const USDA_KEY = process.env.REACT_APP_USDA_API_KEY || ''

function clean(val) {
  if (!val) return ''
  return String(val).trim()
}

function firstOf(...vals) {
  return vals.find(v => v && String(v).trim().length > 0) || ''
}

async function queryOpenFoodFactsFamily(upc, subdomain) {
  try {
    const res = await fetch(
      `https://${subdomain}.openfoodfacts.org/api/v0/product/${upc}.json`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    return {
      source:       subdomain,
      brand:        clean(p.brands?.split(',')[0]),
      description:  clean(firstOf(p.product_name_en, p.product_name)),
      package_size: clean(p.quantity),
      category:     clean(p.categories?.split(',')[0]),
      calories:     p.nutriments?.['energy-kcal_100g'] ? Math.round(p.nutriments['energy-kcal_100g']) : null,
      image_url:    clean(p.image_small_url || p.image_url),
    }
  } catch { return null }
}

async function queryUSDA(upc) {
  if (!USDA_KEY) return null
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${upc}&api_key=${USDA_KEY}&limit
