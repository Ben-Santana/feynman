type Preview = typeof import('./ClassModelPreview').default
let preview: Preview | undefined
let pending: Promise<Preview> | undefined

export function loadedClassModelPreview() { return preview }

export function preloadClassModelPreview(): Promise<Preview> {
  return pending ??= import('./ClassModelPreview').then(module => {
    preview = module.default
    return preview
  }).catch(error => {
    pending = undefined
    throw error
  })
}
