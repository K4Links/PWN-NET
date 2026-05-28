import { X, Info, Zap, Terminal, Shield } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c0c0c] border border-neon-green/30 w-full max-w-lg rounded-2xl flex flex-col max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-neon-green/20 bg-black/40 shrink-0">
          <div className="flex items-center gap-2 text-neon-green font-bold tracking-widest text-sm uppercase">
            <Info size={16} />
            About PWN//NET
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-neon-green p-1 transition-colors bg-neon-green/5 rounded"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto font-mono text-sm text-gray-300 space-y-6 flex-1">
          <section>
            <h3 className="text-neon-green font-bold flex items-center gap-2 mb-2 uppercase text-xs">
              <Zap size={14} className="text-yellow-400" />
              What is PWN//NET?
            </h3>
            <p className="leading-relaxed opacity-90 text-[13px]">
              PWN//NET is a multifaceted network diagnostic and security probing platform. It brings a variety of real-world assessment tools straight to your fingertips, replacing typical simulated components with functional API connections and live diagnostic capabilities.
            </p>
          </section>

          <section>
            <h3 className="text-neon-green font-bold flex items-center gap-2 mb-2 uppercase text-xs">
              <Terminal size={14} className="text-blue-400" />
              Key Features
            </h3>
            <ul className="space-y-3 opacity-90 text-[13px]">
              <li className="flex gap-2">
                <span className="text-neon-green">▸</span>
                <div>
                  <strong className="text-white font-medium block">Pwnux CLI</strong>
                  A fully integrated terminal environment mapping standard commands (ping, whois, curl) to actual backend resolution endpoints.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-neon-green">▸</span>
                <div>
                  <strong className="text-white font-medium block">Reconnaissance & OSINT</strong>
                  Tools utilizing real public databases. Shodan queries, DNS mapping, Certificate lookups, and WHOIS information gatherers.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-neon-green">▸</span>
                <div>
                  <strong className="text-white font-medium block">Web Infrastructure Analysis</strong>
                  Live directory scanners, WordPress presence detection, and React/Next.js bundle analyzers to pinpoint application frameworks.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-neon-green">▸</span>
                <div>
                  <strong className="text-white font-medium block">Network Diagnostics</strong>
                  Actual socket tracing and ICMP sweeps (e.g., Traceroute, Net Scan, Port Scan) for diagnosing connectivity or exposed services.
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-neon-green font-bold flex items-center gap-2 mb-2 uppercase text-xs">
              <Shield size={14} className="text-red-400" />
              Usage Guidelines
            </h3>
            <p className="leading-relaxed opacity-90 text-[13px]">
              These tools perform real network connections and requests. Always ensure you have authorization to test or scan the target infrastructure. PWN//NET leverages backend proxying for certain tools (like stress tests and crawlers) to bypass browser CORS limitations, directly interacting with the targets provided.
            </p>
          </section>
        </div>
        
        <div className="p-4 border-t border-neon-green/20 bg-black/40 shrink-0 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-neon-green/10 text-neon-green border border-neon-green/50 font-bold uppercase tracking-widest text-[10px] rounded hover:bg-neon-green hover:text-black transition-colors"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
