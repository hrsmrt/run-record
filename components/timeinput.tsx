"use client";
import { useState } from "react";

export function TimeInput() {
  const [time, setTime] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // hh:mm:ss または hh:mm:ss.aaaa の形式チェック
    const regex = /^(\d{1,2}):([0-5]\d):([0-5]\d)(\.\d{1,4})?$/;
    if (!regex.test(time)) {
      alert("hh:mm:ss または hh:mm:ss.aaaa の形式で入力してください");
      return;
    }

    alert(`入力されたタイム: ${time}`);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Time (hh:mm:ss[.aaaa]):
        <input
          type="text"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="01:23:45.6789"
          className="border px-2 py-1"
        />
      </label>
    </form>
  );
}