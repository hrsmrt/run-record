"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CsvRecord = {
  time: string;
  distance: string;
  race_name: string;
  race_type: string;
  date: string;
  comment: string | null;
};

export function CsvUploader() {
  const [csvRecords, setCsvRecords] = useState<CsvRecord[]>([]);

  const handleCsvUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result;
      if (!text || typeof text !== "string") return;

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 1) {
        alert("CSVにデータがありません");
        return;
      }

    
const records = lines.map((line, idx) => {
  const values = line.split(",").map(v => v.trim());
  if (values.length < 6) {
    console.warn(`CSV行 ${idx + 1} は列数が足りません`);
    return null;
  }
  const [time, distance, race_name, race_type, date, comment] = values;

  return {
    time,
    distance,
    race_name,
    race_type: race_type || "road",
    date: date || new Date().toISOString().split("T")[0],
    comment: comment || null,
  };
}).filter((r): r is CsvRecord => r !== null); // null を除外し型を絞る

      setCsvRecords(records); // 状態に保持
      alert(`${records.length} 件のデータを読み込みました`);
    };

    reader.readAsText(file);
  };

  const insertCsvRecords = async () => {
    if (csvRecords.length === 0) {
      alert("まずCSVをアップロードしてください");
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("ログインしてください");
      return;
    }

    const rows = csvRecords.map(r => ({
      user_id: user.id,
      time_ms: timeToMs(r.time),
      distance: Number(r.distance),
      race_name: r.race_name,
      race_type: r.race_type || "road",
      date: r.date || new Date().toISOString().split("T")[0],
      comment: r.comment || null,
    }));

    const { error } = await supabase.from("results").insert(rows);
    if (error) {
      alert(`CSV登録でエラー: ${error.message}`);
    } else {
      alert(`${rows.length} 件の記録を追加しました！`);
      setCsvRecords([]); // 挿入後は状態をクリア
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <input
        type="file"
        accept=".csv"
        onChange={(e) => handleCsvUpload(e.target.files)}
      />
      {csvRecords.length > 0 && (
        <p>{csvRecords.length} 件のレコードを読み込みました。</p>
      )}
      <button
        onClick={insertCsvRecords}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        データベースに追加
      </button>
    </div>
  );
}

// timeToMs関数は以前のものを使う
function timeToMs(timeStr: string): number {
  const regex = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/;
  const match = timeStr.match(regex);

  if (!match) {
    throw new Error("Invalid time format. Use hh:mm:ss.aa");
  }

  const [, hh, mm, ss, aa] = match;
  const hours = parseInt(hh, 10);
  const minutes = parseInt(mm, 10);
  const seconds = parseInt(ss, 10);
  const centiseconds = aa ? parseInt(aa, 10) : 0;

  return hours * 3600 * 1000 + minutes * 60 * 1000 + seconds * 1000 + centiseconds * 10;
}