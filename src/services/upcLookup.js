const USDA_KEY = process.env.REACT_APP_USDA_API_KEY || ""

function clean(val) {
  if (!val) return ""
  return String(val).trim()
}

function firstOf(...vals) {
  return vals.find(v => v && String(v).trim().length > 0) || ""
}

async function queryOFF(upc, subdomain) {
  try {
    const res = await fetch(
      "https://" + subdomain + ".openfoodfacts.org/api/v0/product/" + upc + ".json",
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    return {
      source: subdomain,
      brand: clean(p.brands ? p.brands.split(",")[0] : ""),
      description: clean(p.product_name_en || p.product_name || ""),
      package_size: clean(p.quantity || ""),
      category: clean(p.categories ? p.categories.split(",")[0] : ""),
      calories: p.nutriments && p.nutriments["energy-kcal_100g"]
        ? Math.round(p.nutriments["energy-kcal_100g"]) : null,
    }
  } catch(e) { return null }
}

async function queryUSDA(upc) {
  if (!USDA_KEY) return null
  try {
    const url = "https://api.nal.usda.gov/fdc/v1/foods/search?query=" + upc + "&api_key=" + USDA_KEY + "&limit=1"
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.foods || data.foods.length === 0) return null
    const f = data.foods[0]
    const cal = f.foodNutrients
      ? f.foodNutrients.find(function(n) { return n.nutrientName && n.nutrientName.toLowerCase().includes("energy") && n.unitName === "KCAL" })
      : null
    return {
      source: "usda",
      brand: clean(f.brandOwner || f.brandName || ""),
      description: clean(f.description || f.lowercaseDescription || ""),
      package_size: clean(f.packageWeight || ""),
      category: clean(f.foodCategory || ""),
      calories: cal ? Math.round(cal.value) : null,
    }
  } catch(e) { return null }
}

async function queryUPCItemDB(upc) {
  try {
    const res = await fetch(
      "https://api.upcitemdb.com/prod/trial/lookup?upc=" + upc,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.items || data.items.length === 0) return null
    const item = data.items[0]
    return {
      source: "upcitemdb",
      brand: clean(item.brand || ""),
      description: clean(item.title || ""),
      package_size: "",
      category: clean(item.category || ""),
      calories: null,
    }
  } catch(e) { return null }
}

export async function lookupUPC(upc) {
  const digits = upc.replace(/[^0-9]/g, "")
  if (digits.length < 6) return { found: false, upc: digits }
  const cleaned = digits.padStart(12, "0")

  const settled = await Promise.allSettled([
    queryOFF(cleaned, "world"),
    queryOFF(cleaned, "beauty"),
    queryOFF(cleaned, "pet"),
    queryOFF(cleaned, "openproductsfacts"),
    queryUSDA(cleaned),
    queryUPCItemDB(cleaned),
  ])

  const results = settled
    .filter(function(r) { return r.status === "fulfilled" && r.value !== null })
    .map(function(r) { return r.value })

  if (results.length === 0) return { found: false, upc: cleaned }

  return {
    found: true,
    upc: cleaned,
    source: results[0].source,
    brand: firstOf.apply(null, results.map(function(r) { return r.brand })),
    description: firstOf.apply(null, results.map(function(r) { return r.description })),
    package_size: firstOf.apply(null, results.map(function(r) { return r.package_size })),
    category: firstOf.apply(null, results.map(function(r) { return r.category })),
    calories: (results.find(function(r) { return r.calories }) || {}).calories || null,
  }
}
