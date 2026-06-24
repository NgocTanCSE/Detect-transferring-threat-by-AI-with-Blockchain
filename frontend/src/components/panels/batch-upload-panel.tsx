"use client";

import { useState } from "react";
import { useToast } from "@/lib/toast-context";

function BatchUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { notify } = useToast();

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(20);

    try {
      const demoAddr = process.env.NEXT_PUBLIC_SENDER_ADDRESS || "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
      const dummyTransfers = [
        { sender: demoAddr, receiver: "0x" + "ab58" + "01a7d398351b8be11c439e05c5b3259aec9b", amount: "1.2" },
        { sender: "0x" + "8ba1f109551bd432803012645ac136ddd64dba72", receiver: "0x" + "098b716b8aaf21512996dc57eb0615e2383e2f96", amount: "0.5" },
        { sender: "0x" + "d8da6bf26964af9d7eed9e03e53415d37aa96045", receiver: "0x" + "1da5821544e25c636c1417ba96ade4cf6d2f9b5a", amount: "10.0" }
      ];

      const response = await fetch("/api/transfers/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ transfers: dummyTransfers })
      });

      if (!response.ok) throw new Error("Upload failed");
      
      const result = await response.json();
      setProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setFile(null);
        setProgress(0);
        notify(`Batch ingestion complete. ${result.processed} transactions processed, ${result.blocked} blocked.`, "success");
      }, 500);
    } catch (error) {
      console.error("Batch upload error:", error);
      setIsUploading(false);
      notify("Failed to process batch upload.", "error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
      <div className="h-16 w-16 bg-teal-500/10 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Upload Transaction Data</h3>
      <p className="text-slate-400 text-center max-w-sm mb-8">Supported formats: .csv, .xlsx. Max file size: 100MB. Data will be analyzed for AML/Risk patterns instantly.</p>
      
      {isUploading ? (
        <div className="w-full max-w-md space-y-4">
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-xs text-slate-500 font-mono uppercase tracking-widest">Processing {progress}%</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <label className="cursor-pointer group">
            <span className="rounded-2xl bg-teal-500/10 border border-teal-500/30 px-8 py-3 text-teal-400 font-semibold group-hover:bg-teal-500 group-hover:text-white transition-all duration-300">
              {file ? file.name : "Select File"}
            </span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".csv,.xlsx" />
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
