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

// ── Open Food Facts family ─────────────────────────────────────────────────
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

// ── USDA FoodData Central ──────────────────────────────────────────────────
async function queryUSDA(upc) {
  if (!USDA_KEY) return null
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${upc}&api_key=${USDA_KEY}&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.foods || data.foods.length === 0) return null
    const f = data.foods[0]
    const calories = f.foodNutrients?.find(n =>
      n.nutrientName?.toLowerCase().includes('energy') &&
      n.unitName === 'KCAL'
    )
    return {
      source:       'usda',
      brand:        clean(f.brandOwner || f.brandName),
      description:  clean(f.description || f.lowercaseDescription),
      package_size: clean(f.packageWeight),
      category:     clean(f.foodCategory),
      calories:     calories ? Math.round(calories.value) : null,
      image_url:    null,
    }
  } catch { return null }
}

// ── UPC Item DB ────────────────────────────────────────────────────────────
async function queryUPCItemDB(upc) {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.items || data.items.length === 0) return null
    const item = data.items[0]
    return {
      source:       'upcitemdb',
      brand:        clean(item.brand),
      description:  clean(item.title),
      package_size: '',
      category:     clean(item.category),
      calories:     null,
      image_url:    item.images?.[0] || null,
    }
  } catch { return null }
}

// ── Main lookup function ───────────────────────────────────────────────────
export async function lookupUPC(upc) {
  const cleaned = upc.replace(/\D/g, '')
  if (cleaned.length < 6) return { found: false, upc: cleaned }

  // Run all lookups concurrently with a race — take first non-null result
  // but also keep all results to merge the best data
  const [
    offResult,
    beautyResult,
    petResult,
    productsResult,
    usdaResult,
    upcdbResult,
  ] = await Promise.allSettled([
    queryOpenFoodFactsFamily(cleaned, 'world'),
    queryOpenFoodFactsFamily(cleaned, 'beauty'),
    queryOpenFoodFactsFamily(cleaned, 'pet'),
    queryOpenFoodFactsFamily(cleaned, 'openproductsfacts'),
    queryUSDA(cleaned),
    queryUPCItemDB(cleaned),
  ])

  const results = [offResult, beautyResult, petResult, productsResult, usdaResult, upcdbResult]
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)

  if (results.length === 0) return { found: false, upc: cleaned }

  // Merge: take the best value for each field across all results
  const merged = {
    found:        true,
    upc:          cleaned,
    source:       results[0].source,
    brand:        firstOf(...results.map(r => r.brand)),
    description:  firstOf(...results.map(r => r.description)),
    package_size: firstOf(...results.map(r => r.package_size)),
    category:     firstOf(...results.map(r => r.category)),
    calories:     results.find(r => r.calories)?.calories || null,
    image_url:    results.find(r => r.image_url)?.image_url || null,
  }

  return merged
}
