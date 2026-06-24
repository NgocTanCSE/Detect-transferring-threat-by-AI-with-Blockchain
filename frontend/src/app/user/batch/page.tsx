"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { authFetch } from "@/lib/api";
import { useToast } from "@/lib/toast-context";

interface BatchResult {
  total: number;
  processed: number;
  blocked: number;
  failed: number;
  details: Array<{ tx: { sender: string; receiver: string; amount: string }; status: string; reason?: string; tx_hash?: string; error?: string }>;
}

function parseCsvFile(text: string): Array<{ sender: string; receiver: string; amount: string }> {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const senderIdx = header.findIndex(h => h === "from_address" || h === "sender" || h === "from");
  const receiverIdx = header.findIndex(h => h === "to_address" || h === "receiver" || h === "to");
  const amountIdx = header.findIndex(h => h === "amount" || h === "amount_eth" || h === "value");

  if (senderIdx === -1 || receiverIdx === -1 || amountIdx === -1) return [];

  const transfers: Array<{ sender: string; receiver: string; amount: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    const sender = cols[senderIdx];
    const receiver = cols[receiverIdx];
    const amount = cols[amountIdx];
    if (sender?.startsWith("0x") && receiver?.startsWith("0x") && amount) {
      transfers.push({ sender: sender.toLowerCase(), receiver: receiver.toLowerCase(), amount });
    }
  }
  return transfers;
}

export default function BatchUploadPage() {
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setProgress(10);

    try {
      const text = await selectedFile.text();
      setProgress(30);
      const transfers = parseCsvFile(text);

      if (transfers.length === 0) {
        throw new Error("No valid transfers found. CSV must have from_address, to_address, amount columns.");
      }

      setProgress(50);
      const response = await authFetch("/api/transfers/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfers })
      });

      if (!response.ok) throw new Error("Batch upload failed");
      const batchResult: BatchResult = await response.json();

      setProgress(100);
      setResult(batchResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      notify(message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">Batch Data Ingestion</h1>
          <p className="text-slate-400 max-w-lg mx-auto">Upload transaction datasets for retrospective AI risk analysis and historical scanning.</p>
        </div>

        {!result ? (
          <Card className="bg-slate-900/40 border-slate-800 border-dashed border-2 hover:border-teal-500/50 transition-all">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                <Upload className="h-10 w-10 text-teal-400" />
              </div>

              {selectedFile ? (
                <>
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-slate-500 text-sm mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-white mb-2">Select a CSV file</h3>
                  <p className="text-slate-500 mb-8 max-w-xs">Required columns: from_address, to_address, amount</p>
                </>
              )}

              {isUploading ? (
                <div className="w-full max-w-sm space-y-4 mt-6">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing... {progress}%
                  </p>
                </div>
              ) : (
                <div className="flex gap-3 mt-6">
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="border-slate-700 text-slate-300">
                    Choose File
                  </Button>
                  {selectedFile && (
                    <Button onClick={handleUpload} className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-10">
                      Upload & Analyze
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/50 border-teal-500/30 overflow-hidden">
            <div className="bg-teal-500/10 p-6 flex items-center gap-4 border-b border-teal-500/20">
              <CheckCircle2 className="h-8 w-8 text-teal-500" />
              <div>
                <h3 className="text-xl font-bold text-white">Upload Successful</h3>
                <p className="text-teal-400/70 text-sm">Processed {result.processed} transactions. {result.blocked} blocked, {result.failed} failed.</p>
              </div>
            </div>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Processed</p>
                  <p className="text-3xl font-bold text-teal-400">{result.processed}</p>
                  <p className="text-xs text-slate-400">Transactions accepted</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Blocked</p>
                  <p className="text-3xl font-bold text-red-500">{result.blocked}</p>
                  <p className="text-xs text-slate-400">Blacklisted receivers</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Failed</p>
                  <p className="text-3xl font-bold text-amber-400">{result.failed}</p>
                  <p className="text-xs text-slate-400">Processing errors</p>
                </div>
              </div>
              <div className="mt-8 flex gap-4">
                <Button onClick={resetUpload} className="flex-1 bg-slate-800 hover:bg-slate-700">Upload Another</Button>
                <Button onClick={() => window.location.href = "/user/dashboard"} className="flex-1 bg-teal-500 text-slate-950 font-bold hover:bg-teal-600">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-900/30 border-slate-800/50">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <CardTitle className="text-base text-white">CSV Format</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 leading-relaxed">Required columns: from_address, to_address, amount. Optional: chain (default: ethereum).</p>
              <pre className="mt-2 text-xs text-slate-500 bg-slate-950/50 rounded-lg p-3">from_address,to_address,amount
0xabc...,0xdef...,0.5</pre>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/30 border-slate-800/50">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <CardTitle className="text-base text-white">Compliance Alert</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 leading-relaxed">Large batch uploads are subject to automatic Audit Logging. Ensure all data conforms to GDPR and local financial privacy laws.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
