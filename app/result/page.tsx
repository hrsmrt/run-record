import { prisma } from '@/lib/client';
import { redirect } from 'next/navigation';

export async function search(formData: FormData) {
  'use server';
  
  const distance = formData.get('distance');
  const order = formData.get('order');
  const cending = formData.get('cending')
  const racetype = formData.get('racetype')

  const query = new URLSearchParams();
  if (distance) query.set('distance', distance.toString());
  if (order) query.set('order', order.toString());
  if (cending) query.set('cending', cending.toString());
  if (racetype) query.set('racetype', racetype.toString())

  redirect(`/result?${query.toString()}`);
}

export default async function Page({ searchParams }: { searchParams: {racetype?: string, distance?: string , cending?: string, order?: string} }) {
  const params = await searchParams;
  const racetype = params.racetype;
  const distance = params.distance;
  const cending = params.cending || "desc";
  const order = params.order || "date"; // date, time, distance
  let results: any[] = [];

  let where: any = {};
  if (racetype) {
    where.race = {
      ...where.race,
      course: {
        ...where.race?.course,
        type : racetype}
    }}
  if (distance == "others_under100") {
    where.race = {
      ...where.race,
      course: {
        ...where.race?.course,
        distance: {
            notIn: [3, 5, 10, 20, 21.0975, 42.195,100],
            lt: 100
          }}}
    } else if (distance == "others_over100") {
    where.race = {
      ...where.race,
      course: {
        ...where.race?.course,
        distance: {
            notIn: [3, 5, 10, 20, 21.0975, 42.195,100],
            gt: 100
          }}}
  } else if (distance) {
    where.race = {
      ...where.race,
      course: {
        ...where.race?.course,
        distance: Number(distance)
      }}}
  let orderBy: any = {};
  if (order == "date") {
    orderBy.race =  {
      date: cending
  }}
  if (order == "time") {
    orderBy =  {
          time: cending
  }}
  if (order == "distance") {
    orderBy = {
      distance: cending
    }
  }
  console.log(where)
  console.log(orderBy)
  results = await prisma.result.findMany({
      where,
      include: { race: { include: { course: { include: { competition: true } } } }, race_participant: true },
      orderBy,
      take: 10,
    });
  
  const racetypes = [
    "track", "road", "trail", "time"
  ]
  const distances = [
    { value: 3, display: "3km" },
    { value: 5, display: "5km" },
    { value: 10, display: "10km" },
    { value: 21.0975, display: "ハーフマラソン" },
    { value: 42.195, display: "フルマラソン" },
    { value: 100, display: "100km" },
    { value: "others_under100", display: "その他(100km以下)" },
    { value: "others_over100", display: "その他(100km以上)" }
  ]
  const cendings = [
    "asc", "desc"
  ]
  const orders = [
    "date", "time", "distance"
  ]

  const racetypeRadios = racetypes.map((raceType, index) =>
    <label key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><input type="radio" name="racetype" value={raceType} /> {raceType}</label>
  )
  const distanceRadios = distances.map((distance, index) =>
    <label key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><input type="radio" name="distance" value={distance.value} /> {distance.display}</label>
  )
  const cendingRadios = cendings.map((cending, index) =>
    <label key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><input type="radio" name="cending" value={cending} /> {cending}</label>
  )
  const orderRadios = orders.map((order, index) =>
    <label key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><input type="radio" name="order" value={order} /> {order}</label>
  )
  const tableItems = (results ?? []).map(result =>
    <tr key={result.id}>
      <td className="px-4 py-2">
        {result.race.course.competition.name}({result.race.date.toLocaleDateString("ja-JP")})
      </td>
      <td className="px-4 py-2">
        {result.race_participant?.map(p => (
          <div key={p.member_id}>{p.member_id}</div>
        ))}
      </td>
      <td className="px-4 py-2">
        {Math.floor(result.time / 3600000)}:
        {Math.floor(result.time % 3600000 / 60000)}:
        {Math.floor(result.time % 60000 / 1000)}
      </td>
      <td className="px-4 py-2">
        {result.race.course.distance}km
        ({result.race.course.type})
      </td>
    </tr>
  );
  return (
    <div className="bg-white">
        <div>
          <form action={search}>
            <p className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              分類: {racetypeRadios}
            </p>
            <p className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              距離: {distanceRadios}
            </p>
            <p className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              並び順: ({cendingRadios}){orderRadios}
            </p>
            <hr />
            <button type="reset" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reset</button>
            <button type="submit" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Search</button>
          </form>
        </div>
      {/* 検索結果のテーブル */}
      {results.length > 0 && (
        <div>
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    大会
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    名前
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    記録
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
        </div>
      )}
    </div>
  )
}
