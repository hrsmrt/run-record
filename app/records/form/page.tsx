"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeToMs } from "@/lib/utils"; // 既存の timeToMs 関数を流用
import { CsvUploader } from "@/components/CsvUploadForm"

export default function AddRecordForm() {
  const [time, setTime] = useState("");
  const [distance, setDistance] = useState("");
  const [raceName, setRaceName] = useState("");
  const [raceType, setRaceType] = useState("");
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");


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

    const { error } = await supabase.from("results").insert({
      user_id: user.id,
      time_ms: timeToMs(time),
      distance: Number(distance),
      race_name: raceName,
      race_type: raceType || "road",
      date: date || new Date().toISOString().split("T")[0],
      comment: comment || null,
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
    }
  };

  return (
    <div>
      {/* 単体フォーム */}
      <form
        onSubmit={handleSubmit}
        className="max-w-md mx-auto p-6 bg-white shadow rounded-lg space-y-4"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">タイム(01:23:45)</span>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="01:23:45"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">距離(km)</span>
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              required
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">大会名</span>
            <input
              type="text"
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              required
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">種別</span>
            <select
              value={raceType}
              onChange={(e) => setRaceType(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
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
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              required
            />
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32 text-right whitespace-nowrap">コメント</span>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
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

      {/* CSVアップロード */}
      <CsvUploader />
        
        <p className="text-xs mt-2 text-gray-500">
          CSVフォーマット: time,distance,race_name,race_type,yyyy-mm-dd,comment
        </p>
        <p>race_type: road, trail, track, time</p>

      <p className="max-w-md mx-auto mt-4 text-xs text-gray-500">
        ※ タイム: ネットタイムを推奨。グロスタイムはコメント欄へ
        <br />
        ※ 距離について: フルマラソンは42.195, ハーフマラソンは21.0975, 100kmは100 など
      </p>
    </div>
  );
}