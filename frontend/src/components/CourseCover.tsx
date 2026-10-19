import { courseBannerClass, type CourseBanner } from '../courseAppearance'
import './CourseCover.css'

export function CourseCover({ banner, imageUrl, className = '' }: { banner?: CourseBanner; imageUrl?: string | null; className?: string }) {
  return <div className={`course-cover ${courseBannerClass(banner)} ${className}`} aria-hidden="true">
    {banner?.type === 'image' && imageUrl && <img src={imageUrl} alt="" />}
    <span className="course-cover-shape course-cover-shape-one" /><span className="course-cover-shape course-cover-shape-two" /><span className="course-cover-shape course-cover-shape-three" />
  </div>
}

