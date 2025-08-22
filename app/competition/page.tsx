import { prisma } from '@/lib/client';

// [Use Supabase with Next.js | Supabase Docs](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
// [Rendering Lists – React](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)

export default async function Page() {
  const allRace = await prisma.race.findMany({
    include: {
      course: {
        include: {
          competition: true
        }
      }
    },
    orderBy: {
      date: "desc"
    }
  })
  const tableItems = (allRace ?? []).map(race =>
    <tr key={race.id}>
      <td className="px-4 py-2">
        {race.course.competition.name}
      </td>
      <td className="px-4 py-2">
        {race.date.toLocaleDateString("ja-JP")}
      </td>
      <td className="px-4 py-2">
        {race.course.distance}km
        ({race.course.type})
      </td>
    </tr>
  );
  return (
    <div className="overflow-x-auto w-full bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              大会名
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              日付
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              コメント
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              種目
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 text-gray-800">
          {tableItems}
        </tbody>
      </table>
    </div>
  );
}
