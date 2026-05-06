"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";

export default function BatchUploadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setIsUploading(false);
        setIsFinished(true);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">Batch Data Ingestion</h1>
          <p className="text-slate-400 max-w-lg mx-auto">Upload transaction datasets for retrospective AI risk analysis and historical scanning.</p>
        </div>

        {!isFinished ? (
          <Card className="bg-slate-900/40 border-slate-800 border-dashed border-2 hover:border-teal-500/50 transition-all">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10 text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Drag and drop your file here</h3>
              <p className="text-slate-500 mb-8 max-w-xs">Supports CSV, XLSX up to 50MB per batch (Max 100,000 transactions).</p>
              
              {isUploading ? (
                <div className="w-full max-w-sm space-y-4">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing risk patterns... {progress}%
                  </p>
                </div>
              ) : (
                <Button onClick={handleUpload} size="lg" className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-10">
                  Select File
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/50 border-teal-500/30 overflow-hidden">
            <div className="bg-teal-500/10 p-6 flex items-center gap-4 border-b border-teal-500/20">
              <CheckCircle2 className="h-8 w-8 text-teal-500" />
              <div>
                <h3 className="text-xl font-bold text-white">Upload Successful</h3>
                <p className="text-teal-400/70 text-sm">Processed 12,450 transactions in 4.2 seconds.</p>
              </div>
            </div>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Risk Detected</p>
                  <p className="text-3xl font-bold text-amber-400">142</p>
                  <p className="text-xs text-slate-400">Requires manual review</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Critical Threat</p>
                  <p className="text-3xl font-bold text-red-500">18</p>
                  <p className="text-xs text-slate-400">Auto-blocked transfers</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Confidence</p>
                  <p className="text-3xl font-bold text-white">99.8%</p>
                  <p className="text-xs text-slate-400">AI Model Accuracy</p>
                </div>
              </div>
              <div className="mt-8 flex gap-4">
                <Button className="flex-1 bg-slate-800 hover:bg-slate-700">Download Full Analysis</Button>
                <Button className="flex-1 bg-teal-500 text-slate-950 font-bold hover:bg-teal-600">
                  Go to Investigator Dashboard <ArrowRight className="ml-2 h-4 w-4" />
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
              <CardTitle className="text-base text-white">Template Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 leading-relaxed">Download our CSV template to ensure your transaction headers match our AI engine requirements (from_address, to_address, amount, timestamp).</p>
              <Button variant="link" className="text-teal-400 p-0 mt-2 h-auto">Download Template.csv</Button>
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
