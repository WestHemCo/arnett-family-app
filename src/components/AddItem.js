import React, { useState, useEffect, useRef } from "react"
import { supabase } from "../supabase"
import { lookupUPC } from "../services/upcLookup"

const LOCATIONS = ["pantry","fridge","freezer","spices","household"]
const LOCATION_LABELS = {
  pantry:"Pantry", fridge:"Fridge", freezer:"Freezer",
  spices:"Spices", household:"Household"
}

export default function AddItem({ onSave, onCancel, defaultLocation }) {
  const loc = defaultLocation || "pantry"
  const [form, setForm] = useState({
    location: loc, brand:"", category:"", description:"",
    package_size:"", qty_on_hand:"", unit:"", low_threshold:"",
    expiration_date:"", notes:"", store:"", cost_per_unit:""
  })
  const [upc, setUpc]             = useState("")
  const [scanning, setScanning]   = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [upcStatus, setUpcStatus] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(function() { return function() { stopScanner() } }, [])

  function setField(field, value) { setForm(function(f) { return Object.assign({}, f, { [field]: value }) }) }

  async function startScan() {
    setScanning(true)
    setUpcStatus(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const detector = new window.BarcodeDetector({
        formats: ["ean_13","ean_8","upc_a","upc_e","code_128","code_39"]
      })
      const scan = async function() {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(scan)
          return
        }
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            stopScanner()
            await handleUPCFound(codes[0].rawValue)
            return
          }
        } catch(e) {}
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    } catch(err) {
      stopScanner()
      setUpcStatus(err.name === "NotAllowedError" ? "camera_denied" : "camera_error")
    }
  }

  function stopScanner() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop() })
    streamRef.current = null
    rafRef.current = null
    setScanning(false)
  }

  async function handleUPCFound(code) {
    setUpc(code)
    setLookingUp(true)
    const result = await lookupUPC(code)
    applyResult(result)
    setLookingUp(false)
  }

  async function handleManualUPC(e) {
    const val = e.target.value
    setUpc(val)
    if (val.replace(/[^0-9]/g,"").length >= 8) {
      setLookingUp(true)
      const result = await lookupUPC(val)
      applyResult(result)
      setLookingUp(false)
    }
  }

  function applyResult(result) {
    if (!result.found) { setUpcStatus("not_found"); return }
    setForm(function(f) {
      return Object.assign({}, f, {
        brand:        result.brand        || f.brand,
        description:  result.description  || f.description,
        package_size: result.package_size || f.package_size,
        category:     result.category     || f.category,
      })
    })
    setUpcStatus("found")
  }

  async function handleSave() {
    if (!form.description.trim()) { setError("Description is required"); return }
    setSaving(true)
    setError(null)
    const payload = Object.assign({}, form, {
      upc:             upc || null,
      qty_on_hand:     form.qty_on_hand     !== "" ? parseFloat(form.qty_on_hand)     : null,
      low_threshold:   form.low_threshold   !== "" ? parseFloat(form.low_threshold)   : null,
      cost_per_unit:   form.cost_per_unit   !== "" ? parseFloat(form.cost_per_unit)   : null,
      expiration_date: form.expiration_date || null,
      store:           form.store           || null,
    })
    const result = await supabase.from("inventory_items").insert([payload])
    if (result.error) { setError(result.error.message); setSaving(false); return }
    setSaving(false)
    onSave()
  }

  const MSG = {
    found:        { text: "Product found - fields filled in below", color: "#16A34A" },
    not_found:    { text: "Not found in any database - fill in manually", color: "#D97706" },
    camera_denied:{ text: "Camera access denied - check browser settings", color: "#DC2626" },
    camera_error: { text: "Camera error - type UPC manually", color: "#DC2626" },
  }

  return (
    React.createElement("div", { style: s.overlay },
      React.createElement("div", { style: s.modal },
        React.createElement("div", { style: s.modalHeader },
          React.createElement("h2", { style: s.modalTitle }, "Add Inventory Item"),
          React.createElement("button", { style: s.closeBtn, onClick: onCancel }, "X")
        ),
        scanning && React.createElement("div", { style: s.scannerWrap },
          React.createElement("video", { ref: videoRef, style: s.video, muted: true, playsInline: true }),
          React.createElement("div", { style: s.scanFrame }),
          React.createElement("p", { style: s.scanHint }, "Point at a barcode"),
          React.createElement("button", { style: s.cancelScanBtn, onClick: stopScanner }, "Cancel scan")
        ),
        !scanning && React.createElement("div", { style: s.upcRow },
          React.createElement("div", { style: { flex:1 } },
            React.createElement("label", { style: s.label }, "UPC / Barcode"),
            React.createElement("input", { style: s.input, placeholder: "Scan or type barcode", value: upc, onChange: handleManualUPC }),
            lookingUp && React.createElement("div", { style: s.upcMsg }, "Searching 6 databases..."),
            !lookingUp && upcStatus && MSG[upcStatus] && React.createElement("div", { style: Object.assign({}, s.upcMsg, { color: MSG[upcStatus].color }) }, MSG[upcStatus].text)
          ),
          React.createElement("button", { style: s.scanBtn, onClick: startScan }, "Scan")
        ),
        React.createElement("div", { style: s.fields },
          React.createElement("div", { style: s.row },
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Location *"),
              React.createElement("select", { style: s.input, value: form.location, onChange: function(e) { setField("location", e.target.value) } },
                LOCATIONS.map(function(l) { return React.createElement("option", { key: l, value: l }, LOCATION_LABELS[l]) })
              )
            ),
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Category"),
              React.createElement("input", { style: s.input, value: form.category, onChange: function(e) { setField("category", e.target.value) }, placeholder: "e.g. Canned Goods" })
            )
          ),
          React.createElement("div", { style: s.fg },
            React.createElement("label", { style: s.label }, "Description *"),
            React.createElement("input", { style: s.input, value: form.description, onChange: function(e) { setField("description", e.target.value) }, placeholder: "e.g. Tomato Soup" })
          ),
          React.createElement("div", { style: s.row },
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Brand"),
              React.createElement("input", { style: s.input, value: form.brand, onChange: function(e) { setField("brand", e.target.value) }, placeholder: "e.g. Campbell's" })
            ),
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Package Size"),
              React.createElement("input", { style: s.input, value: form.package_size, onChange: function(e) { setField("package_size", e.target.value) }, placeholder: "e.g. 10.75oz Can" })
            )
          ),
          React.createElement("div", { style: s.row },
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Qty on Hand"),
              React.createElement("input", { style: s.input, type: "number", value: form.qty_on_hand, onChange: function(e) { setField("qty_on_hand", e.target.value) }, placeholder: "0" })
            ),
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Unit"),
              React.createElement("input", { style: s.input, value: form.unit, onChange: function(e) { setField("unit", e.target.value) }, placeholder: "e.g. cans, oz" })
            ),
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Low Threshold"),
              React.createElement("input", { style: s.input, type: "number", value: form.low_threshold, onChange: function(e) { setField("low_threshold", e.target.value) }, placeholder: "0" })
            )
          ),
          React.createElement("div", { style: s.row },
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Expiration Date"),
              React.createElement("input", { style: s.input, type: "date", value: form.expiration_date, onChange: function(e) { setField("expiration_date", e.target.value) } })
            ),
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Store"),
              React.createElement("input", { style: s.input, value: form.store, onChange: function(e) { setField("store", e.target.value) }, placeholder: "e.g. Kroger" })
            ),
            React.createElement("div", { style: s.fg },
              React.createElement("label", { style: s.label }, "Cost / Unit ($)"),
              React.createElement("input", { style: s.input, type: "number", step: "0.01", value: form.cost_per_unit, onChange: function(e) { setField("cost_per_unit", e.target.value) }, placeholder: "0.00" })
            )
          ),
          React.createElement("div", { style: s.fg },
            React.createElement("label", { style: s.label }, "Notes"),
            React.createElement("input", { style: s.input, value: form.notes, onChange: function(e) { setField("notes", e.target.value) }, placeholder: "Optional notes" })
          ),
          error && React.createElement("div", { style: s.errorBox }, error),
          React.createElement("div", { style: s.actions },
            React.createElement("button", { style: s.cancelBtn, onClick: onCancel }, "Cancel"),
            React.createElement("button", { style: s.saveBtn, onClick: handleSave, disabled: saving }, saving ? "Saving..." : "Save Item")
          )
        )
      )
    )
  )
}

const s = {
  overlay:       { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex",
                   alignItems:"center", justifyContent:"center", zIndex:200, padding:"16px" },
  modal:         { background:"#FFFFFF", borderRadius:"16px", width:"100%", maxWidth:"560px",
                   maxHeight:"92vh", overflowY:"auto" },
  modalHeader:   { display:"flex", justifyContent:"space-between", alignItems:"center",
                   padding:"20px 24px 16px", borderBottom:"1px solid #E2E8F0" },
  modalTitle:    { fontSize:"18px", fontWeight:"600", color:"#1A252F", margin:0 },
  closeBtn:      { background:"none", border:"none", fontSize:"18px", color:"#64748B", cursor:"pointer" },
  scannerWrap:   { position:"relative", background:"#000", margin:"16px 24px 0",
                   borderRadius:"12px", overflow:"hidden" },
  video:         { width:"100%", display:"block" },
  scanFrame:     { position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                   width:"260px", height:"120px", border:"2px solid #2563EB", borderRadius:"8px",
                   boxShadow:"0 0 0 9999px rgba(0,0,0,0.4)" },
  scanHint:      { position:"absolute", bottom:"40px", width:"100%", textAlign:"center",
                   color:"#fff", fontSize:"13px", fontWeight:"500", margin:0 },
  cancelScanBtn: { position:"absolute", bottom:"10px", left:"50%", transform:"translateX(-50%)",
                   padding:"7px 18px", background:"rgba(0,0,0,0.6)", color:"#fff", border:"none",
                   borderRadius:"20px", fontSize:"13px", cursor:"pointer" },
  upcRow:        { padding:"16px 24px 0", display:"flex", gap:"10px", alignItems:"flex-end" },
  scanBtn:       { padding:"10px 16px", background:"#1A252F", color:"#FFFFFF", border:"none",
                   borderRadius:"8px", fontSize:"14px", fontWeight:"500", cursor:"pointer",
                   whiteSpace:"nowrap", height:"40px" },
  upcMsg:        { fontSize:"12px", color:"#64748B", marginTop:"4px" },
  fields:        { padding:"16px 24px 24px", display:"flex", flexDirection:"column", gap:"14px" },
  row:           { display:"flex", gap:"12px", flexWrap:"wrap" },
  fg:            { display:"flex", flexDirection:"column", gap:"4px", flex:1, minWidth:"120px" },
  label:         { fontSize:"12px", fontWeight:"500", color:"#374151" },
  input:         { padding:"9px 12px", borderRadius:"8px", border:"1px solid #CBD5E1",
                   fontSize:"14px", color:"#1A252F", outline:"none", width:"100%" },
  errorBox:      { background:"#FEE2E2", color:"#7F1D1D", padding:"10px 14px",
                   borderRadius:"8px", fontSize:"13px" },
  actions:       { display:"flex", justifyContent:"flex-end", gap:"10px", marginTop:"4px" },
  cancelBtn:     { padding:"10px 20px", background:"transparent", border:"1px solid #CBD5E1",
                   borderRadius:"8px", fontSize:"14px", color:"#64748B", cursor:"pointer" },
  saveBtn:       { padding:"10px 24px", background:"#1A252F", color:"#FFFFFF", border:"none",
                   borderRadius:"8px", fontSize:"14px", fontWeight:"600", cursor:"pointer" },
}
