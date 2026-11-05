"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeToMs } from "@/lib/utils"; // 既存の timeToMs 関数を流用
import { RaceDatalist, RaceInput, useRaceOptions } from "@/components/RaceInput";
import { MemberSelect } from "@/components/MemberSelect";
import { DivisionDatalist } from "@/components/RaceDivisionsEditor";
import { parseCount } from "@/lib/ranks";
import { getAdminState } from "@/lib/admin";
import Link from "next/link";

export default function AddRecordForm() {
  const [time, setTime] = useState("");
  const [distance, setDistance] = useState("");
  const [raceName, setRaceName] = useState("");
  const [raceType, setRaceType] = useState("");
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const [raceId, setRaceId] = useState<number | null>(null);
  const [cleverIndex, setCleverIndex] = useState("");
  // 順位（大会の公式順位を転記）と部門
  const [overallRank, setOverallRank] = useState("");
  const [genderRank, setGenderRank] = useState("");
  const [division, setDivision] = useState("");
  const [divisionRank, setDivisionRank] = useState("");
  const [message, setMessage] = useState("");
  // 送信後に大会検索欄を空に戻すためのキー
  const [resetKey, setResetKey] = useState(0);
  const { options: raceOptions, error: raceError } = useRaceOptions();
  // 管理者は登録先のメンバーを選べる（それ以外は常に自分）
  const [selfId, setSelfId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // 管理者機能は2段階認証済みのときだけ使える
  const [adminNeedsMfa, setAdminNeedsMfa] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  useEffect(() => {
    getAdminState(createClient()).then(({ user, isAdmin, adminActive }) => {
      if (!user) return;
      setSelfId(user.id);
      setTargetUserId(user.id);
      setIsAdmin(adminActive);
      setAdminNeedsMfa(isAdmin && !adminActive);
    });
  }, []);

  // --- 単体フォーム送信 ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("ログインしてください");
      return;
    }

    const regex = /^(\d{1,2}):([0-5]\d):([0-5]\d)(\.\d{1,4})?$/;
    if (!regex.test(time)) {
      alert("hh:mm:ss または hh:mm:ss.aa の形式で入力してください");
      return;
    }

    if (cleverIndex !== "" && isNaN(Number(cleverIndex))) {
      setMessage("クレバー指数は数値で入力してください");
      return;
    }

    const ranks = { overall_rank: parseCount(overallRank), gender_rank: parseCount(genderRank), division_rank: parseCount(divisionRank) };
    if (Object.values(ranks).includes(undefined)) {
      setMessage("順位は正の整数で入力してください");
      return;
    }

    const { error } = await supabase.from("results").insert({
      user_id: isAdmin && targetUserId ? targetUserId : user.id,
      time_ms: timeToMs(time),
      distance: Number(distance),
      race_name: raceName,
      race_type: raceType || "road",
      date: date || new Date().toISOString().split("T")[0],
      comment: comment || null,
      race_id: raceId,
      clever_index: cleverIndex === "" ? null : Number(cleverIndex),
      ...ranks,
      division: division.trim() || null,
    });

    if (error) {
      setMessage(`エラー: ${error.message}`);
    } else {
      setMessage("記録を追加しました！");
      setTime("");
      setDistance("");
      setRaceName("");
      setRaceType("");
      setDate("");
      setComment("");
      setRaceId(null);
      setCleverIndex("");
      setOverallRank("");
      setGenderRank("");
      setDivision("");
      setDivisionRank("");
      setResetKey(k => k + 1);
    }
  };

  return (
    <div>
      {/* 単体フォーム */}
      <form
        onSubmit={handleSubmit}
        className="max-w-md mx-auto p-6 bg-white shadow rounded-lg space-y-4 text-black"
      >
        <div className="flex flex-col gap-4">
          {adminNeedsMfa && (
            <p className="text-xs text-gray-500">
              他のメンバーの記録を登録するには
              <Link href="/auth/mfa?next=/records/form" className="text-blue-600 hover:underline">2段階認証</Link>
              が必要です
            </p>
          )}
          {isAdmin && selfId && targetUserId && (
            <div className="flex items-center">
              <span className="mr-2 w-32 text-right whitespace-nowrap">登録先（管理者）</span>
              <MemberSelect
                selfId={selfId}
                value={targetUserId}
                onChange={setTargetUserId}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 bg-white"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-center">
              <span className="mr-2 w-32 text-right whitespace-nowrap">大会（任意）</span>
              {raceOptions ? (
                <>
                  <RaceInput
                    key={resetKey}
                    listId="race-options"
                    options={raceOptions}
                    value={raceId}
                    onChange={race => {
                      setRaceId(race?.id ?? null);
                      if (race) {
                        setRaceName(race.eventName);
                        if (race.heldOn) setDate(race.heldOn);
                        setDistance(String(race.distanceKm));
                      }
                    }}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white border"
                  />
                  <RaceDatalist id="race-options" options={raceOptions} />
                </>
              ) : (
                <span className="flex-1 text-sm text-gray-500">読み込み中...</span>
              )}
            </div>
            <p className="text-xs text-gray-500 text-right">
              大会情報に登録済みの大会は、選ぶと大会名・日付・距離が入力されます
            </p>
            {raceError && <p className="text-xs text-red-600 text-right">大会情報の読み込みに失敗しました: {raceError}</p>}
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">タイム(01:23:45)</span>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="01:23:45"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">距離(km)</span>
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
              required
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">大会名</span>
            <input
              type="text"
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
              required
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">種別</span>
            <select
              value={raceType}
              onChange={(e) => setRaceType(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
              required
            >
              <option value="road">ロード</option>
              <option value="trail">トレイル</option>
              <option value="track">トラック</option>
              <option value="time">時間走</option>
            </select>
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">日付</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 min-w-[140px] rounded-md border border-gray-300 shadow-sm 
             focus:border-blue-500 focus:ring-blue-500 
             px-3 py-2 bg-white text-black"
              required
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">クレバー指数</span>
            <input
              type="text"
              inputMode="decimal"
              value={cleverIndex}
              onChange={(e) => setCleverIndex(e.target.value)}
              placeholder="RUNNET の値（任意）"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            />
          </div>
          {([
            ["総合順位", overallRank, setOverallRank],
            ["男女別順位", genderRank, setGenderRank],
          ] as const).map(([label, value, set]) => (
            <div key={label} className="flex items-center">
              <span className="mr-2 w-32 text-right whitespace-nowrap">{label}</span>
              <input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder="任意"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
              />
            </div>
          ))}
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">部門・部門順位</span>
            <input
              type="text"
              list="division-options"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="例: 男子40歳代"
              className="flex-1 min-w-0 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            />
            <DivisionDatalist id="division-options" raceId={raceId} />
            <input
              type="text"
              inputMode="numeric"
              value={divisionRank}
              onChange={(e) => setDivisionRank(e.target.value)}
              placeholder="順位"
              aria-label="部門順位"
              className="ml-2 w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">コメント</span>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white text-black"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-md px-4 py-2 font-semibold hover:bg-blue-700 transition"
        >
          記録を追加
        </button>
        {message && <p>{message}</p>}
      </form>

      <p className="max-w-md mx-auto mt-4 text-black">
        ※ タイム: ネットタイムを推奨。グロスタイムはコメント欄へ
        <br />
        ※ 距離: フルマラソンは42.195, ハーフマラソンは21.0975, 100kmは100 など
        <br />
        ※ 順位: 大会の公式順位をそのまま入力（最近の市民マラソンはネットタイム順が多い）。部門名は大会の表記のまま
      </p>
    </div>
  );
}
