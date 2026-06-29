"use client";

import { useState, useRef } from "react";
import { useToast } from "@/lib/toast-context";

interface TransferRow {
  sender: string;
  receiver: string;
  amount: string;
}

function parseCsvFile(csvText: string): TransferRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const senderIdx = header.findIndex((h) => h === "sender" || h === "from_address" || h === "from");
  const receiverIdx = header.findIndex((h) => h === "receiver" || h === "to_address" || h === "to");
  const amountIdx = header.findIndex((h) => h === "amount" || h === "amount_eth" || h === "value");

  if (senderIdx === -1 || receiverIdx === -1 || amountIdx === -1) {
    throw new Error("CSV phải có cột: sender/from_address, receiver/to_address, amount/amount_eth");
  }

  const transfers: TransferRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length > Math.max(senderIdx, receiverIdx, amountIdx)) {
      const sender = cols[senderIdx];
      const receiver = cols[receiverIdx];
      const amount = cols[amountIdx];
      if (sender && receiver && amount && sender.startsWith("0x") && receiver.startsWith("0x")) {
        transfers.push({ sender, receiver, amount });
      }
    }
  }
  return transfers;
}

function BatchUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ processed: number; blocked: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(10);
    setResult(null);

    try {
      const text = await file.text();
      setProgress(30);

      const transfers = parseCsvFile(text);
      if (transfers.length === 0) {
        throw new Error("Không tìm thấy giao dịch hợp lệ trong file");
      }
      setProgress(50);

      const response = await fetch("/api/transfers/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ transfers }),
      });

      setProgress(80);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || body?.error || "Upload failed");
      }

      const data = await response.json();
      setProgress(100);

      const processed = data.processed || data.total || transfers.length;
      const blocked = data.blocked || 0;
      setResult({ processed, blocked });

      setTimeout(() => {
        setIsUploading(false);
        setFile(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        notify(`Hoàn thành: ${processed} giao dịch đã xử lý, ${blocked} bị chặn.`, "success");
      }, 500);
    } catch (error) {
      console.error("Batch upload error:", error);
      setIsUploading(false);
      setProgress(0);
      const message = error instanceof Error ? error.message : "Upload failed";
      notify(`Lỗi: ${message}`, "error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
      <div className="h-16 w-16 bg-teal-500/10 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Upload Transaction Data</h3>
      <p className="text-slate-400 text-center max-w-sm mb-2">Supported formats: .csv. Max file size: 100MB.</p>
      <p className="text-slate-500 text-center text-xs max-w-sm mb-8">
        CSV phải có cột: sender/from_address, receiver/to_address, amount/amount_eth
      </p>

      {isUploading ? (
        <div className="w-full max-w-md space-y-4">
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-xs text-slate-500 font-mono uppercase tracking-widest">Processing {progress}%</p>
        </div>
      ) : result ? (
        <div className="text-center space-y-3">
          <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <p className="text-teal-400 font-semibold">Hoàn thành!</p>
            <p className="text-slate-300 text-sm mt-1">
              {result.processed} giao dịch đã xử lý, {result.blocked} bị chặn
            </p>
          </div>
          <button
            onClick={() => { setResult(null); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            className="text-sm text-slate-400 hover:text-white underline"
          >
            Upload thêm
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <label className="cursor-pointer group">
            <span className="rounded-2xl bg-teal-500/10 border border-teal-500/30 px-8 py-3 text-teal-400 font-semibold group-hover:bg-teal-500 group-hover:text-white transition-all duration-300">
              {file ? file.name : "Select CSV File"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".csv"
            />
          </label>
          {file && (
            <button onClick={handleUpload} className="text-sm text-slate-300 underline hover:text-white">
              Confirm and Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BatchUploadPanel;
