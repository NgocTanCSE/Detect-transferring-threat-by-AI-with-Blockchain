"use client";

import React, { useMemo } from 'react';
import { Shield, ArrowRight, Link2, ExternalLink } from 'lucide-react';

interface Connection {
  address: string;
  direction: 'incoming' | 'outgoing';
  tx_count: number;
  total_value_eth: number;
  risk_score: number;
  account_status: string;
}

interface WalletNetworkGraphProps {
  centerAddress: string;
  connections: Connection[];
  onNodeClick?: (address: string) => void;
}

const WalletNetworkGraph: React.FC<WalletNetworkGraphProps> = ({ 
  centerAddress, 
  connections = [], 
  onNodeClick 
}) => {
  const nodes = useMemo(() => {
    const centerNode = {
      id: centerAddress,
      x: 250,
      y: 250,
      isCenter: true,
      risk: 0, // Will be updated if needed
      label: 'Target'
    };

    const outerNodes = connections.map((conn, i) => {
      const angle = (i / connections.length) * 2 * Math.PI;
      const radius = 180;
      return {
        id: conn.address,
        x: 250 + radius * Math.cos(angle),
        y: 250 + radius * Math.sin(angle),
        isCenter: false,
        risk: conn.risk_score,
        direction: conn.direction,
        value: conn.total_value_eth,
        count: conn.tx_count
      };
    });

    return [centerNode, ...outerNodes];
  }, [centerAddress, connections]);

  const getRiskColor = (score: number) => {
    if (score >= 80) return '#ef4444'; // red-500
    if (score >= 50) return '#f59e0b'; // amber-500
    if (score >= 20) return '#eab308'; // yellow-500
    return '#14b8a6'; // teal-500
  };

  if (!connections || connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 italic">
        <Link2 className="h-12 w-12 mb-4 opacity-20" />
        <p>No connections found for this address.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px] flex items-center justify-center">
      <svg viewBox="0 0 500 500" className="w-full h-full max-w-[600px] drop-shadow-2xl">
        {/* Connection Lines */}
        {nodes.filter(n => !n.isCenter).map((node, i) => (
          <line
            key={`line-${i}`}
            x1="250"
            y1="250"
            x2={node.x}
            y2={node.y}
            stroke={node.risk && node.risk > 50 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(20, 184, 166, 0.15)'}
            strokeWidth={1 + Math.min((node.count || 0) / 5, 4)}
            strokeDasharray={node.direction === 'incoming' ? '4 2' : '0'}
            className={node.direction === 'incoming' ? 'animate-[dash_10s_linear_infinite]' : ''}
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g 
            key={`node-${i}`} 
            className="cursor-pointer transition-transform hover:scale-110"
            onClick={() => onNodeClick?.(node.id)}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.isCenter ? 30 : 20}
              fill="#0f172a"
              stroke={getRiskColor(node.risk || 0)}
              strokeWidth="2"
            />
            {node.isCenter ? (
              <Shield 
                x={node.x - 12} 
                y={node.y - 12} 
                size={24} 
                className="text-teal-400" 
              />
            ) : (
               <text
                 x={node.x}
                 y={node.y + 35}
                 textAnchor="middle"
                 className="text-[10px] fill-slate-500 font-mono"
               >
                 {node.id.substring(0, 6)}...
               </text>
            )}
            
            {/* Risk Badge for outer nodes */}
            {!node.isCenter && node.risk && node.risk > 0 && (
               <circle
                 cx={node.x + 15}
                 cy={node.y - 15}
                 r="8"
                 fill={getRiskColor(node.risk)}
               />
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" /> High Risk (>80)
         </div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500" /> Low Risk
         </div>
         <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-slate-500 mr-1" /> ------ Incoming Flow
         </div>
      </div>

      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
      `}</style>
    </div>
  );
};

export default WalletNetworkGraph;
