"use client";

import { CsvUploader } from "@/components/CsvUploadForm"

export default function AddRecordForm() {
  return (
    <div className="max-w-md mx-auto p-4">
      {/* CSVアップロード */}
      <CsvUploader />
        
        <p className="mt-2 text-black">
          形式: time,distance(km),race_name,race_type,comment(ヘッダー無し)
        </p>
        <p>time: hh:mm:ss または hh:mm:ss.aa</p>
        <p>race_type: road, trail, track, time</p>
        <p>date: YYYY-MM-DD</p>

      <p className="max-w-md mx-auto mt-4 text-black">
        ※ タイム: ネットタイムを推奨。グロスタイムはコメント欄へ
        <br />
        ※ 距離: フルマラソンは42.195, ハーフマラソンは21.0975, 100kmは100 など
      </p>
    </div>
  );
}
