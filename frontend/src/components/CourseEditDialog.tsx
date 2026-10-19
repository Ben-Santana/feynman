import { accountSignal } from '../accounts'
import { removeUnusedCourseBanner, updateCourseDetails, uploadCourseBanner, type Course } from '../courseStore'
import { BannerEditDialog } from './BannerEditDialog'

export function CourseEditDialog({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: (course: Course) => void }) {
  return <BannerEditDialog initialBanner={course.banner} imageUrl={course.bannerUrl} onClose={onClose} onSave={async (banner, file) => {
    const signal = accountSignal()
    let uploaded: string | undefined
    try {
      if (file) { uploaded = await uploadCourseBanner(course.id, file); banner = { type: 'image', path: uploaded } }
      signal.throwIfAborted()
      const updated = await updateCourseDetails(course, { banner })
      signal.throwIfAborted()
      if (course.banner?.type === 'image' && (banner.type !== 'image' || banner.path !== course.banner.path)) void removeUnusedCourseBanner(course.banner.path).catch(() => {})
      onSaved(updated)
    } catch (reason) {
      if (uploaded && !signal.aborted) void removeUnusedCourseBanner(uploaded).catch(() => {})
      throw reason
    }
  }} />
}
