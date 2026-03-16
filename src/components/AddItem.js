import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { lookupUPC } from '../services/upcLookup'

const LOCATIONS = ['pantry','fridge','freezer','spices','household']
const LOCATION_LABELS = {
  pantry:'Pantry', fridge:'Fridge', freezer:'Freezer',
  spices:'Spices', household:'Household'
}

const SCANNER_ID = 'arnett-barcode-scanner'

function BarcodeScanner({ onDetected, onClose }) {
  const scannerRef = useRef(null)

  useEffect(() => {
    let scanner = null

    async function startScanner() {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')
        scanner = new Html5QrcodeScanner(
          SCANNER_ID,
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            rememberLastUsedCamera: true,
            aspectRatio: 1.7,
            showTorchButtonIfSupported: true,
            formatsToSupport: [
              0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
            ],
          },
          false
        )
        scannerRef.current = scanner
        scanner.render(
          (decodedText) => {
            onDetected(decodedText)
          },
          () => {}
        )
      } catch (err) {
        console.error('Scanner init error:', err)
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  return (
    <div style={s.scannerWrap}>
      <div id={SCANNER_ID} style={{ width: '100%' }} />
      <button style={s.closeScanBtn} onClick={onClose}>
        Cancel scan
      </button>
    </div>
  )
}

export default function AddItem({ onSave, onCancel, defaultLocation = 'pantry' }) {
  const [form, setForm] = useState({
    location: defaultLocation, brand:'', category:'', description:'',
    package_size:'', qty_on_hand:'', unit:'', low_threshold:'',
    expiration_date:'', notes:'', store:'', cost_per_unit:''
  })
  const [upc, setUpc]             = useState('')
  const [scanning, setScanning]   = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [upcStatus, setUpcStatus] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleDetected(code) {
    setScanning(false)
    setUpc(code)
    setLookingUp(true)
    const result = await lookupUPC(code)
    applyResult(result)
    setLookingUp(false)
  }

  async function handleManualUPC(e) {
    const val = e.target.value
    setUpc(val)
    if (val.replace(/\D/g,'').length >= 8) {
      setLookingUp(true)
      const result = await lookupUPC(val)
      applyResult(result)
      setLookingUp(false)
    }
  }

  function applyResult(result) {
    if (!result.found) { setUpcStatus('not_found'); return }
    setForm(f => ({
      ...f,
      brand:        result.brand        || f.brand,
      description:  result.description  || f.description,
      package_size: result.package_size || f.package_size,
      category:     result.category     || f.category,
    }))
    setUpcStatus('found')
  }

  async function handleSave() {
    if (!form.description.trim()) { setError('Description is required'); return }
    setSaving(true); setError(null)
    const { error } = await supabase.from('inventory_items').insert([{
      ...form,
      upc:             upc || null,
      qty_on_hand:     form.qty_on_hand     !== '' ? parseFloat(form.qty_on_hand)     : null,
      low_threshold:   form.low_threshold   !== '' ? parseFloat(form.low_threshold)   : null,
      cost_per_unit:   form.cost_per_unit   !== '' ? parseFloat(form.cost_per_unit)   : null,
      expiration_date: form.expiration_date || null,
      store:           form.store           || null,
    }])
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false)
    onSave()
  }

  const MSG = {
    found:     { text:'Product found — fields filled in below', color:'#16A34A' },
    not_found: { text:'Not found in any database — fill in manually', color:'#D97706' },
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Add Inventory Item</h2>
          <button style={s.closeBtn} onClick={onCancel}>✕</button>
        </div>

        {/* Scanner — mounts/unmounts cleanly */}
        {scanning && (
          <BarcodeScanner
            onDetected={handleDetected}
            onClose={() => setScanning(false)}
          />
        )}

        {/* UPC row */}
        {!scanning && (
          <div style={s.upcRow}>
            <div style={{ flex:1 }}>
              <label style={s.label}>UPC / Barcode</label>
              <input
                style={s.input}
                placeholder="Scan or type barcode"
                value={upc}
                onChange={handleManualUPC}
              />
              {lookingUp && <div style={s.upcMsg}>Searching 6 databases...</div>}
              {!lookingUp && upcStatus && MSG[upcStatus] &&
                <div style={{ ...s.upcMsg, color: MSG[upcStatus].color }}>
                  {MSG[upcStatus].text}
                </div>}
            </div>
            <button style={s.scanBtn} onClick={() => setScanning(true)}>
              Scan
            </button>
          </div>
        )}

        {/* Form fields */}
        {!scanning && (
          <div style={s.fields}>
            <div style={s.row}>
              <div style={s.fg}>
                <label style={s.label}>Location *</label>
                <select style={s.input} value={form.location} onChange={e => set('location', e.target.value)}>
                  {LOCATIONS.map(l => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
                </select>
              </div>
              <div style={s.fg}>
                <label style={s.label}>Category</label>
                <input style={s.input} value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Canned Goods" />
              </div>
            </div>

            <div style={s.fg}>
              <label style={s.label}>Description *</label>
              <input style={s.input} value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Tomato Soup" />
            </div>

            <div style={s.row}>
              <div style={s.fg}>
                <label style={s.label}>Brand</label>
                <input style={s.input} value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Campbell's" />
              </div>
              <div style={s.fg}>
                <label style={s.label}>Package Size</label>
                <input style={s.input} value={form.package_size} onChange={e => set('package_size', e.target.value)} placeholder="e.g. 10.75oz Can" />
              </div>
            </div>

            <div style={s.row}>
              <div style={s.fg}>
                <label style={s.label}>Qty on Hand</label>
                <input style={s.input} type="number" value={form.qty_on_hand} onChange={e => set('qty_on_hand', e.target.value)} placeholder="0" />
              </div>
              <div style={s.fg}>
                <label style={s.label}>Unit</label>
                <input style={s.input} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. cans, oz" />
              </div>
              <div style={s.fg}>
                <label style={s.label}>Low Threshold</label>
                <input style={s.input} type="number" value={form.low_threshold} onChange={e => set('low_threshold', e.target.value)} placeholder="0" />
              </div>
            </div>

            <div style={s.row}>
              <div style={s.fg}>
                <label style={s.label}>Expiration Date</label>
                <input style={s.input} type="date" value={form.expiration_date} onChange={e => set('expiration_date', e.target.value)} />
              </div>
              <div style={s.fg}>
                <label style={s.label}>Store</label>
                <input style={s.input} value={form.store} onChange={e => set('store', e.target.value)} placeholder="e.g. Kroger" />
              </div>
              <div style={s.fg}>
                <label style={s.label}>Cost / Unit ($)</label>
                <input style={s.input} type="number" step="0.01" value={form.cost_per_unit} onChange={e => set('cost_per_unit', e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div style={s.fg}>
              <label style={s.label}>Notes</label>
              <input style={s.input} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" />
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            <div style={s.actions}>
              <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
              <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
                  alignItems:'center', justifyContent:'center', zIndex:200, padding:'16px' },
  modal:        { background:'#FFFFFF', borderRadius:'16px', width:'100%', maxWidth:'560px',
                  maxHeight:'92vh', overflowY:'auto' },
  modalHeader:  { display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'20px 24px 16px', borderBottom:'1px solid #E2E8F0' },
  modalTitle:   { fontSize:'18px', fontWeight:'600', color:'#1A252F', margin:0 },
  closeBtn:     { background:'none', border:'none', fontSize:'18px', color:'#64748B', cursor:'pointer' },
  upcRow:       { padding:'16px 24px 0', display:'flex', gap:'10px', alignItems:'flex-end' },
  scanBtn:      { padding:'10px 16px', background:'#1A252F', color:'#FFFFFF', border:'none',
                  borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer',
                  whiteSpace:'nowrap', height:'40px' },
  upcMsg:       { fontSize:'12px', color:'#64748B', marginTop:'4px' },
  scannerWrap:  { padding:'12px 24px', display:'flex', flexDirection:'column', gap:'8px' },
  closeScanBtn: { padding:'8px 16px', background:'#64748B', color:'#FFFFFF', border:'none',
                  borderRadius:'8px', fontSize:'13px', cursor:'pointer', alignSelf:'center' },
  fields:       { padding:'16px 24px 24px', display:'flex', flexDirection:'column', gap:'14px' },
  row:          { display:'flex', gap:'12px', flexWrap:'wrap' },
  fg:           { display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' },
  label:        { fontSize:'12px', fontWeight:'500', color:'#374151' },
  input:        { padding:'9px 12px', borderRadius:'8px', border:'1px solid #CBD5E1',
                  fontSize:'14px', color:'#1A252F', outline:'none', width:'100%' },
  errorBox:     { background:'#FEE2E2', color:'#7F1D1D', padding:'10px 14px',
                  borderRadius:'8px', fontSize:'13px' },
  actions:      { display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'4px' },
  cancelBtn:    { padding:'10px 20px', background:'transparent', border:'1px solid #CBD5E1',
                  borderRadius:'8px', fontSize:'14px', color:'#64748B', cursor:'pointer' },
  saveBtn:      { padding:'10px 24px', background:'#1A252F', color:'#FFFFFF', border:'none',
                  borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor:'pointer' },
}
