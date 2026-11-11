import { RacePlansOverview } from "@/components/RacePlansOverview"

export default function PlansPage() {
    return (
        <main className="min-h-screen flex flex-col items-center p-4">
            <div className="flex-1 w-full max-w-4xl flex flex-col gap-4">
                <h1 className="text-lg font-bold">大会予定</h1>
                <RacePlansOverview />
            </div>
        </main>
    )
}
