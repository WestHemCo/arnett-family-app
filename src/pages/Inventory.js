import React, { useState, useEffect } from "react"
import { supabase } from "../supabase"
import AddItem from "../components/AddItem"

const LOCATIONS = ["pantry", "fridge", "freezer", "spices", "household"]
const LOCATION_LABELS = {
  pantry: "Pantry", fridge: "Fridge", freezer: "Freezer",
  spices: "Spices", household: "Household"
}
const STATUS_COLORS = {
  "IN STOCK":      { bg: "#DCFCE7", color: "#14532D" },
  "LOW":           { bg: "#FEF9C3", color: "#713F12" },
  "EXPIRING SOON": { bg: "#FFEDD5", color: "#7C2D12" },
  "EXPIRED":       { bg: "#FEE2E2", color: "#7F1D1D" },
  "OUT":           { bg: "#F1F5F9", color: "#475569" },
}

function getStatus(item) {
  if (item.qty_on_hand === 0 || item.qty_on_hand === null) return "OUT"
  if (item.expiration_date) {
    const days = Math.floor((new Date(item.expiration_date) - new Date()) / 86400000)
    if (days <= 0) return "EXPIRED"
    if (days <= 30) return "EXPIRING SOON"
  }
  if (item.low_threshold !== null && item.qty_on_hand <= item.low_threshold) return "LOW"
  return "IN STOCK"
}

export default function Inventory({ session }) {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [activeTab, setActiveTab] = useState("pantry")
  const [search, setSearch]       = useState("")
  const [showAdd, setShowAdd]     = useState(false)

  async function fetchItems() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("category", { ascending: true })
      .order("description", { ascending: true })
    if (error) setError(error.message)
    else setItems(data || [])
    setLoading(false)
  }

  useEffect(function() { fetchItems() }, [])

  function handleSaved() {
    setShowAdd(false)
    fetchItems()
  }

  const tabItems = items.filter(function(i) {
    return i.location === activeTab &&
      (search === "" ||
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        (i.brand && i.brand.toLowerCase().includes(search.toLowerCase())) ||
        (i.category && i.category.toLowerCase().includes(search.toLowerCase())))
  })

  const counts = {}
  LOCATIONS.forEach(function(loc) {
    counts[loc] = items.filter(function(i) { return i.location === loc }).length
  })

  return (
    React.createElement("div", { style: s.page },
      showAdd && React.createElement(AddItem, { onSave: handleSaved, onCancel: function() { setShowAdd(false) }, defaultLocation: activeTab }),
      React.createElement("div", { style: s.pageHeader },
        React.createElement("div", null,
          React.createElement("h1", { style: s.title }, "Inventory"),
          React.createElement("p", { style: s.subtitle }, items.length + " items across all locations")
        ),
        React.createElement("div", { style: { display:"flex", gap:"10px", alignItems:"center" } },
          React.createElement("input", {
            style: s.search, type: "search", placeholder: "Search items...",
            value: search, onChange: function(e) { setSearch(e.target.value) }
          }),
          React.createElement("button", { style: s.addBtn, onClick: function() { setShowAdd(true) } }, "+ Add Item")
        )
      ),
      React.createElement("div", { style: s.tabs },
        LOCATIONS.map(function(loc) {
          return React.createElement("button", {
            key: loc,
            onClick: function() { setActiveTab(loc) },
            style: Object.assign({}, s.tab, activeTab === loc ? s.tabActive : {})
          },
            LOCATION_LABELS[loc],
            React.createElement("span", {
              style: Object.assign({}, s.tabCount, activeTab === loc ? s.tabCountActive : {})
            }, counts[loc] || 0)
          )
        })
      ),
      loading && React.createElement("div", { style: s.state }, React.createElement("div", { style: s.stateText }, "Loading inventory...")),
      error && React.createElement("div", { style: s.errorBox }, error),
      !loading && !error && tabItems.length === 0 && React.createElement("div", { style: s.state },
        React.createElement("div", { style: s.stateText },
          search ? "No results for \"" + search + "\"" : "No items in " + LOCATION_LABELS[activeTab]
        )
      ),
      !loading && !error && tabItems.length > 0 && React.createElement("div", { style: s.tableWrap },
        React.createElement("table", { style: s.table },
          React.createElement("thead", null,
            React.createElement("tr", null,
              ["Brand","Description","Category","Qty","Unit","Expiry","Status","Notes"].map(function(h) {
                return React.createElement("th", { key: h, style: s.th }, h)
              })
            )
          ),
          React.createElement("tbody", null,
            tabItems.map(function(item, i) {
              const status = getStatus(item)
              const sc = STATUS_COLORS[status] || STATUS_COLORS["IN STOCK"]
              const expiry = item.expiration_date
                ? new Date(item.expiration_date).toLocaleDateString("en-US", { month:"short", year:"numeric" })
                : "-"
              return React.createElement("tr", { key: item.id, style: { background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" } },
                React.createElement("td", { style: s.td }, item.brand || "-"),
                React.createElement("td", { style: Object.assign({}, s.td, { fontWeight:"500" }) }, item.description),
                React.createElement("td", { style: Object.assign({}, s.td, { color:"#64748B" }) }, item.category || "-"),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign:"center" }) }, item.qty_on_hand != null ? item.qty_on_hand : "-"),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign:"center", color:"#64748B" }) }, item.unit || "-"),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign:"center", color:"#64748B" }) }, expiry),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign:"center" }) },
                  React.createElement("span", { style: Object.assign({}, s.badge, { background:sc.bg, color:sc.color }) }, status)
                ),
                React.createElement("td", { style: Object.assign({}, s.td, { color:"#64748B", fontSize:"12px" }) }, item.notes || "-")
              )
            })
          )
        )
      )
    )
  )
}

const s = {
  page:       { padding:"24px", maxWidth:"1100px", margin:"0 auto" },
  pageHeader: { display:"flex", alignItems:"flex-start", justifyContent:"space-between",
                flexWrap:"wrap", gap:"12px", marginBottom:"24px" },
  title:      { fontSize:"28px", fontWeight:"600", color:"#1A252F", margin:0 },
  subtitle:   { fontSize:"14px", color:"#64748B", marginTop:"4px" },
  search:     { padding:"8px 14px", borderRadius:"8px", border:"1px solid #CBD5E1",
                fontSize:"14px", width:"200px", outline:"none" },
  addBtn:     { padding:"9px 18px", background:"#2563EB", color:"#FFFFFF", border:"none",
                borderRadius:"8px", fontSize:"14px", fontWeight:"600", cursor:"pointer", whiteSpace:"nowrap" },
  tabs:       { display:"flex", gap:"4px", marginBottom:"16px", borderBottom:"1px solid #E2E8F0" },
  tab:        { background:"transparent", border:"none", padding:"10px 16px",
                fontSize:"14px", fontWeight:"500", color:"#64748B", cursor:"pointer",
                borderBottom:"2px solid transparent", marginBottom:"-1px",
                display:"flex", alignItems:"center", gap:"6px" },
  tabActive:  { color:"#1A252F", borderBottomColor:"#2563EB" },
  tabCount:   { fontSize:"11px", background:"#F1F5F9", color:"#64748B", padding:"1px 6px", borderRadius:"10px" },
  tabCountActive: { background:"#DBEAFE", color:"#1E3A8A" },
  state:      { background:"#FFFFFF", border:"0.5px solid #CBD5E1", borderRadius:"12px", padding:"48px 24px", textAlign:"center" },
  stateText:  { fontSize:"15px", color:"#64748B" },
  errorBox:   { background:"#FEE2E2", color:"#7F1D1D", padding:"12px 16px", borderRadius:"8px", fontSize:"14px", marginBottom:"16px" },
  tableWrap:  { background:"#FFFFFF", border:"0.5px solid #CBD5E1", borderRadius:"12px", overflow:"auto" },
  table:      { width:"100%", borderCollapse:"collapse", fontSize:"13px" },
  th:         { padding:"10px 14px", textAlign:"left", fontSize:"11px", fontWeight:"600",
                color:"#64748B", textTransform:"uppercase", letterSpacing:"0.05em",
                borderBottom:"1px solid #E2E8F0", background:"#F8FAFC", whiteSpace:"nowrap" },
  td:         { padding:"10px 14px", borderBottom:"0.5px solid #F1F5F9", color:"#1A252F", verticalAlign:"middle" },
  badge:      { display:"inline-block", fontSize:"11px", fontWeight:"600", padding:"2px 8px", borderRadius:"10px", whiteSpace:"nowrap" },
}
