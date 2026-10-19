import { useEffect, useRef, useState } from 'react'
import { accountSignal } from '../accounts'
import { courseBannerPresets, defaultCourseBanner, validateCourseBannerFile, type CourseBanner } from '../courseAppearance'
import { CourseCover } from './CourseCover'
import './CoursesPage.css'

export function BannerEditDialog({ initialBanner = defaultCourseBanner, imageUrl, previewClassName = '', onClose, onSave, onReload }: { initialBanner?: CourseBanner; imageUrl?: string | null; previewClassName?: string; onClose: () => void; onReload?: () => void; onSave: (banner: CourseBanner, file: File | null) => Promise<void> }) {
  const [banner, setBanner] = useState<CourseBanner>(initialBanner)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  useEffect(() => {
    let disposed = false
    const url = file ? URL.createObjectURL(file) : null
    queueMicrotask(() => { if (!disposed) setPreview(url) })
    return () => { disposed = true; if (url) URL.revokeObjectURL(url) }
  }, [file])
  function chooseBanner(next: CourseBanner) { setBanner(next); setFile(null); setError('') }
  function chooseFile(next?: File) {
    if (!next) return
    try { validateCourseBannerFile(next); setFile(next); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Choose a valid image.') }
  }
  async function save() {
    if (lock.current) return
    lock.current = true; setSaving(true); setError('')
    const signal = accountSignal()
    try {
      await onSave(banner, file)
      signal.throwIfAborted()
    } catch (reason) {
      if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not save the banner. Please retry.')
    } finally { lock.current = false; if (!signal.aborted) setSaving(false) }
  }
  const previewBanner: CourseBanner = file ? { type: 'image', path: '' } : banner
  return <dialog className="course-edit-dialog" ref={dialog} aria-labelledby="course-edit-title" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void save() }} aria-busy={saving}>
      <div className="course-edit-heading"><h2 id="course-edit-title">Edit banner</h2><button type="button" className="course-dialog-close" aria-label="Close banner editor" disabled={saving} onClick={onClose} autoFocus><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
      <CourseCover className={`course-edit-preview ${previewClassName}`} banner={previewBanner} imageUrl={file ? preview : imageUrl} />
      {file && preview && <img className="course-upload-check" src={preview} alt="" onError={() => { setFile(null); setError('Choose an image that can be opened.') }} />}
      <fieldset className="course-banner-options" disabled={saving}><legend>Banner</legend>
        <div className="course-banner-grid">{courseBannerPresets.map(preset => <button type="button" key={preset.id} className="course-banner-choice" aria-label={`${preset.name} banner`} aria-pressed={!file && banner.type === 'preset' && banner.preset === preset.id} onClick={() => chooseBanner({ type: 'preset', preset: preset.id })}><CourseCover banner={{ type: 'preset', preset: preset.id }} /><span>{preset.name}</span></button>)}</div>
        <div className="course-banner-actions"><button type="button" aria-pressed={!file && banner.type === 'none'} onClick={() => chooseBanner({ type: 'none' })}>No banner</button><label className="course-banner-upload">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { chooseFile(event.target.files?.[0]); event.target.value = '' }} /></label></div>
        <p className="course-banner-file-help">JPG, PNG, or WebP. Up to 5 MB.</p>
      </fieldset>
      {error && <div className="course-edit-error" role="alert"><p>{error}</p>{onReload && <button type="button" className="dashboard-text-link" disabled={saving} onClick={onReload}>Reload banner</button>}</div>}
      <div className="course-edit-footer"><button type="button" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="course-primary-action" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>
  </dialog>
}
