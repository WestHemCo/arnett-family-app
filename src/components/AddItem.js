import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { lookupUPC } from '../services/upcLookup'

const LOCATIONS = ['pantry','fridge','freezer','spices','household']
const LOCATION_LABELS = {
  pantry:'Pantry', fridge:'Fridge', freezer:'Freezer',
  spices:'Spices', household:'Household'
}

export default function AddItem({ onSave, onCancel }) {
  const [form, setForm] = useState({
    location:'pantry', brand:'', category:'', description:'',
    package_size:'', qty_on_hand:'', unit:'', low_threshold:'',
    expiration_date:'', notes:'', store:'', cost_per_unit:''
  })
  const [upc, setUpc]             = useState('')
  const [scanning, setScanning]   = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [upcStatus, setUpcStatus] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const readerRef = useRef(null)

  useEffect(() => { return () => stopCamera() }, [])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function startScan() {
    setScanning(true)
    setUpcStatus(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:'environment', width:{ ideal:1280 }, height:{ ideal:720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({
          formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39']
        })
        const poll = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              clearInterval(poll)
              stopCamera()
              await handleUPCFound(codes[0].rawValue)
            }
          } catch {}
        }, 250)
        readerRef.current = { type:'native', poll }
      } else {
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/library')
          const reader = new BrowserMultiFormatReader()
          readerRef.current = { type:'zxing', reader }
          reader.decodeFromVideoElement(videoRef.current, async (result) => {
            if (result) {
              reader.reset()
              stopCamera()
              await handleUPCFound(result.getText())
            }
          })
        } catch {
          setUpcStatus('unsupported')
          stopCamera()
        }
      }
    } catch (err) {
      setScanning(false)
      setUpcStatus(err.name === 'NotAllowedError' ? 'camera_denied' : 'camera_error')
    }
  }

  function stopCamera() {
    if (readerRef.current?.type === 'native') clearInterval(readerRef.current.poll)
    if (readerRef.current?.type === 'zxing')  readerRef.current.reader.reset()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    readerRef.current = null
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
    found:        { text:'Product found — fields filled in below', color:'#16A34A' },
    not_found:    { text:'Not found in any database — fill in manually', color:'#D97706' },
    unsupported:  { text:'Scanning not supported on this browser — type UPC manually', color:'#D97706' },
    camera_denied:{ text:'Camera access denied — type UPC manually', color:'#DC2626' },
    camera_error: { text:'Camera error — type UPC manually', color:'#DC2626' },
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Add Inventory Item</h2>
          <button style={s.closeBtn} onClick={onCancel}>✕</button>
        </div>

        {scanning && (
          <div style={s.scanner}>
            <video ref={videoRef} style={s.video} muted playsInline />
            <div style={s.scanOverlay}>
              <div style={s.scanFrame}/>
              <p style={s.scanHint}>Point at a barcode</p>
            </div>
            <button style={s.cancelScan} onClick={stopCamera}>Cancel</button>
          </div>
        )}

        {!scanning && (
          <div style={s.upcRow}>
            <div style={{ flex:1 }}>
              <label style={s.label}>UPC / Barcode</label>
              <input style={s.input} placeholder="Scan or type barcode" value={upc} onChange={handleManualUPC} />
              {lookingUp && <div style={s.upcMsg}>Searching 6 databases...</div>}
              {!lookingUp && upcStatus && MSG[upcStatus] &&
                <div style={{ ...s.upcMsg, color: MSG[upcStatus].color }}>{MSG[upcStatus].text}</div>}
            </div>
            <button style={s.scanBtn} onClick={startScan}>Scan</button>
          </div>
        )}

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
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
                alignItems:'center', justifyContent:'center', zIndex:200, padding:'16px' },
  modal:      { background:'#FFFFFF', borderRadius:'16px', width:'100%', maxWidth:'560px',
                maxHeight:'92vh', overflowY:'auto' },
  modalHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'20px 24px 16px', borderBottom:'1px solid #E2E8F0' },
  modalTitle: { fontSize:'18px', fontWeight:'600', color:'#1A252F', margin:0 },
  closeBtn:   { background:'none', border:'none', fontSize:'18px', color:'#64748B', cursor:'pointer' },
  upcRow:     { padding:'16px 24px 0', display:'flex', gap:'10px', alignItems:'flex-end' },
  scanBtn:    { padding:'10px 16px', background:'#1A252F', color:'#FFFFFF', border:'none',
                borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer',
                whiteSpace:'nowrap', height:'40px' },
  upcMsg:     { fontSize:'12px', color:'#64748B', marginTop:'4px' },
  fields:     { padding:'16px 24px 24px', display:'flex', flexDirection:'column', gap:'14px' },
  row:        { display:'flex', gap:'12px', flexWrap:'wrap' },
  fg:         { display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'120px' },
  label:      { fontSize:'12px', fontWeight:'500', color:'#374151' },
  input:      { padding:'9px 12px', borderRadius:'8px', border:'1px solid #CBD5E1',
                fontSize:'14px', color:'#1A252F', outline:'none', width:'100%' },
  errorBox:   { background:'#FEE2E2', color:'#7F1D1D', padding:'10px 14px',
                borderRadius:'8px', fontSize:'13px' },
  actions:    { display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'4px' },
  cancelBtn:  { padding:'10px 20px', background:'transparent', border:'1px solid #CBD5E1',
                borderRadius:'8px', fontSize:'14px', color:'#64748B', cursor:'pointer' },
  saveBtn:    { padding:'10px 24px', background:'#1A252F', color:'#FFFFFF', border:'none',
                borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor:'pointer' },
  scanner:    { position:'relative', background:'#000', margin:'16px 24px 0',
                borderRadius:'8px', overflow:'hidden', aspectRatio:'16/9' },
  video:      { width:'100%', height:'100%', objectFit:'cover' },
  scanOverlay:{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:'12px' },
  scanFrame:  { width:'200px', height:'120px', border:'2px solid #2563EB', borderRadius:'8px' },
  scanHint:   { color:'#FFFFFF', fontSize:'14px', fontWeight:'500', margin:0 },
  cancelScan: { position:'absolute', bottom:'12px', left:'50%', transform:'translateX(-50%)',
                padding:'8px 20px', background:'rgba(0,0,0,0.6)', color:'#FFFFFF',
                border:'none', borderRadius:'20px', fontSize:'13px', cursor:'pointer' },
}
