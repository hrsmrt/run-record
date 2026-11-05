import { yearsSinceEnrollment } from "@/lib/enrollment"

// 名前の横に小さく出す入学年度の下二桁（例: 2017年度入学 →（17））
export function EnrollmentTag({ year }: { year: number | null | undefined }) {
    if (year == null) return null
    return (
        <span className="text-[0.8em] text-gray-500" title={`${year}年度入学（${yearsSinceEnrollment(year)}年目）`}>
            （{String(year % 100).padStart(2, "0")}）
        </span>
    )
}
