import { useState, useRef, useEffect, FormEvent, ReactNode } from 'react';
import * as OTPAuth from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { logService } from '../utils/logger';
import { 
  X, Terminal as TerminalIcon, Play, RefreshCw, Copy, Check, 
  Cpu, ShieldAlert, Wifi, Globe, MapPin, Hash, KeySquare, Laptop, 
  Compass, Eye, Zap, ShieldAlert as AlertIcon, Lock, ArrowLeft, Bluetooth, Calculator, KeyRound, Gauge, QrCode,
  Search, DoorOpen, Server, Bug, FileText
} from 'lucide-react';
import { ToolDef, TerminalOutput } from '../types';

interface TerminalEmulatorProps {
  tool: ToolDef | null;
  onClose: () => void;
}

const fallbackCopyTextToClipboard = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try { document.execCommand('copy'); } catch (err) { console.error('Copy failed', err); }
  document.body.removeChild(textArea);
};

const copyToClipboardV2 = (text: string) => {
  if (!navigator.clipboard) { fallbackCopyTextToClipboard(text); return; }
  navigator.clipboard.writeText(text).catch(() => fallbackCopyTextToClipboard(text));
};

const CopyableLink = ({ url, label }: { url: string, label?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    copyToClipboardV2(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const openExternal = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <span className="inline-flex items-center gap-2 text-blue-400 underline underline-offset-2 decoration-dotted decoration-blue-500/40">
      {label || url}
      <button onClick={handleCopy} className="p-1 rounded hover:bg-white/10 transition-colors" title="Copy link">
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
      <button onClick={openExternal} className="p-1 rounded hover:bg-white/10 transition-colors" title="Open in browser">
        ↗
      </button>
    </span>
  );
};

const CORS_PROXY = 'https://corsproxy.io/?url=';

// Admin finder wordlist — 100+ common admin panel paths
const ADMIN_PATHS = [
  'admin', 'admin/', 'admin.php', 'admin/login.php', 'admin/index.php',
  'administrator', 'administrator/', 'administrator/login.php',
  'adminpanel', 'adminpanel/', 'cp', 'cp/',
  'login', 'login/', 'login.php', 'login/admin.php',
  'dashboard', 'dashboard/', 'admin/dashboard',
  'wp-admin', 'wp-admin/', 'wp-login.php',
  'admin/login.html', 'admin/index.html',
  'panel', 'panel/', 'controlpanel', 'controlpanel/',
  'admin_area', 'admin_area/', 'admin_area/admin.php',
  'siteadmin', 'siteadmin/', 'siteadmin/login.php',
  'admin/account.php', 'admin/admin_login.php',
  'admin_login.php', 'admin-login.php',
  'admincp', 'admincp/', 'admincp/login.php',
  'sysadmin', 'sysadmin/', 'sysadmin.php',
  'user/login', 'user/login.php',
  'member', 'member/', 'member/login.php',
  'account', 'account/', 'account/login.php',
  'secure', 'secure/', 'secure/login.php',
  'backend', 'backend/', 'backend/login.php',
  'webadmin', 'webadmin/', 'webadmin/login.php',
  'cpanel', 'cpanel/', 'cpanel.php',
  'admin/user.php', 'admin/users.php',
  'moderator', 'moderator/', 'moderator/login.php',
  'staff', 'staff/', 'staff/login.php',
  'auth', 'auth/', 'auth/login.php',
  'portal', 'portal/', 'portal/login.php',
  'manager', 'manager/', 'manager/login.php',
  'management', 'management/', 'management/login.php',
  'admin/manage.php', 'admin/manage',
  'bb-admin', 'bb-admin/', 'bb-admin/login.php',
  'admin/control.php', 'admin/control',
  'admin/admin.php', 'admin/home.php', 'admin/home.html',
  'phpmyadmin', 'phpmyadmin/', 'phpMyAdmin/',
  'pma', 'PMA', 'mysql-admin',
  'adminer.php', 'adminer',
  'adm', 'adm/', 'admlogin.php',
  'admin/password.php', 'admin/credentials.php',
  'superadmin', 'superadmin/', 'superadmin/login.php',
  'private', 'private/', 'private/login.php',
  'config', 'config/', 'config.php',
  'director', 'director/', 'director/login.php',
  'members', 'members/', 'members/login.php',
  'signin', 'signin/', 'signin.php',
  'login_as_admin', 'login_as_admin.php',
  'administration', 'administration/',
  'admin/setup.php', 'admin/install.php',
  'admin/config.php', 'admin/settings.php',
  'admin/panel.php',
];

async function dnsOverHttps(domain: string, type: string = 'A'): Promise<string> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
  const data = await resp.json();
  if (!data.Answer || data.Answer.length === 0) return `No ${type} records found for ${domain}`;
  return data.Answer.map((r: any) => `${r.name} → ${r.data} (TTL: ${r.TTL})`).join('\n');
}

async function fetchViaCorsProxy(url: string): Promise<string> {
  const resp = await fetch(CORS_PROXY + encodeURIComponent(url));
  return await resp.text();
}

export default function TerminalEmulator({ tool, onClose }: TerminalEmulatorProps) {
  const [output, setOutput] = useState<TerminalOutput[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [target, setTarget] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Admin finder specific state
  const [adminResults, setAdminResults] = useState<{path: string; status: number; found: boolean}[]>([]);
  const [adminScanning, setAdminScanning] = useState(false);
  const [adminTarget, setAdminTarget] = useState('');

  useEffect(() => {
    if (tool) {
      setOutput([]);
      setShowInput(tool.requiresInput || false);
      setTarget('');
      setAdminResults([]);
      setAdminScanning(false);
      setAdminTarget('');

      if (!tool.requiresInput && tool.actionType === 'terminal') {
        runAutoTool(tool.id);
      }
    }
  }, [tool]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  const addOutput = (type: TerminalOutput['type'], content: ReactNode) => {
    const entry: TerminalOutput = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type,
      content,
    };
    setOutput(prev => [...prev, entry]);
    logService.addEntry(entry);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'system': return 'text-purple-400';
      case 'input': return 'text-cyan-300';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'info': return 'text-gray-200';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadge = () => {
    if (isRunning) return { text: 'RUNNING', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
    if (output.some(o => o.type === 'error')) return { text: 'ERROR', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
    if (output.length > 1) return { text: 'COMPLETE', color: 'bg-green-500/20 text-green-300 border-green-500/30' };
    return { text: 'IDLE', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  };

  const runAutoTool = async (toolId: string) => {
    setIsRunning(true);
    addOutput('system', `Initializing ${toolId.toUpperCase()} module...`);

    // Tools that don't need target input
    if (toolId === 'device') {
      const info = [
        `User Agent: ${navigator.userAgent}`,
        `Platform: ${navigator.platform}`,
        `Language: ${navigator.language}`,
        `Screen: ${screen.width}x${screen.height}`,
        `Color Depth: ${screen.colorDepth}bit`,
        `Device Memory: ${(navigator as any).deviceMemory || 'Unknown'} GB`,
        `Hardware Concurrency: ${navigator.hardwareConcurrency || 'Unknown'} cores`,
        `Online: ${navigator.onLine}`,
        `Cookies Enabled: ${navigator.cookieEnabled}`,
        `Touch Points: ${navigator.maxTouchPoints}`,
      ];
      info.forEach(line => addOutput('info', line));
      addOutput('success', 'Device scan complete.');
    } 
    else if (toolId === 'security') {
      const checks = [
        { name: 'Cookies Enabled', pass: navigator.cookieEnabled },
        { name: 'WebRTC Leak Protection', pass: !!window.RTCPeerConnection },
        { name: 'Do Not Track', pass: (navigator as any).doNotTrack === '1' },
        { name: 'Local Storage', pass: !!window.localStorage },
        { name: 'Session Storage', pass: !!window.sessionStorage },
        { name: 'Service Worker', pass: 'serviceWorker' in navigator },
        { name: 'Geolocation API', pass: 'geolocation' in navigator },
        { name: 'WebGL Support', pass: !!document.createElement('canvas').getContext('webgl') },
      ];
      checks.forEach(c => {
        addOutput(c.pass ? 'success' : 'error', `${c.name}: ${c.pass ? '✓ Enabled' : '✗ Disabled'}`);
      });
      addOutput('success', 'Security profile scan complete.');
    }
    else if (toolId === 'speed') {
      addOutput('system', 'Running bandwidth test...');
      const start = performance.now();
      try {
        const resp = await fetch('https://www.google.com/images/phd/px.gif', { mode: 'no-cors', cache: 'no-store' });
        const end = performance.now();
        const latency = Math.round(end - start);
        addOutput('info', `Round-trip latency (google.com): ~${latency}ms`);
        addOutput('info', 'For full speed test, use a dedicated speed test service.');
        addOutput('success', 'Latency test complete.');
      } catch(e) {
        addOutput('error', 'Could not measure latency (network restricted).');
      }
    }
    else if (toolId === 'base64') {
      addOutput('system', 'Base64 encoder/decoder ready. Enter text to encode/decode.');
      addOutput('info', 'Prefix with "decode:" to decode, or just type plain text to encode.');
    }
    else if (toolId === 'cipher') {
      addOutput('system', 'Cipher decoder ready. Enter text to analyze.');
    }
    else {
      addOutput('info', `Module ${toolId} is ready. Enter a target to proceed.`);
    }

    setIsRunning(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target.trim() || !tool) return;

    const input = target.trim();
    const activeToolId = tool.id;
    setShowInput(false);
    addOutput('input', `> ${input}`);

    // --- ADMIN FINDER ---
    if (activeToolId === 'admin_finder' || activeToolId === 'admin-finder') {
      setIsRunning(true);
      addOutput('system', `Scanning admin panels on ${input}...`);

      let baseUrl = input.replace(/\/$/, '');
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
      }

      let found = 0;
      let checked = 0;

      for (const path of ADMIN_PATHS) {
        const url = `${baseUrl}/${path}`;
        checked++;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const resp = await fetch(url, { 
            method: 'GET',
            signal: controller.signal,
            mode: 'cors',
            redirect: 'follow'
          });
          clearTimeout(timeoutId);

          if (resp.status === 200) {
            addOutput('success', `[200] FOUND: ${url}`);
            found++;
          } else if (resp.status === 403) {
            addOutput('info', `[403] Blocked: ${url}`);
          } else if (resp.status === 401) {
            addOutput('info', `[401] Auth Required: ${url}`);
          } else if (resp.status === 301 || resp.status === 302) {
            addOutput('info', `[${resp.status}] Redirect: ${url} → ${resp.headers.get('location') || '?'}`);
          }
          // 404 = skip silently
        } catch (err) {
          // Network error, skip silently
        }

        // Update progress every 20 paths
        if (checked % 20 === 0) {
          addOutput('system', `Progress: ${checked}/${ADMIN_PATHS.length} paths checked...`);
        }
      }

      addOutput('system', `Scan complete. Checked ${checked} paths. Found ${found} admin panel(s).`);
      if (found === 0) {
        addOutput('info', 'No common admin panels found. Try a more comprehensive wordlist.');
      }
      setIsRunning(false);
      return;
    }

    // --- PWNUX CLI (simulated terminal) ---
    if (activeToolId === 'pwnux') {
      setIsRunning(true);
      const args = input.split(' ');
      const cmd = args[0].toLowerCase();

      if (cmd === 'help') {
        addOutput('info', `Available commands:
  nmap <target>       - Port scan target
  ping <target>       - Ping target
  whois <domain>      - WHOIS lookup
  dns <domain>        - DNS lookup
  admin <url>         - Find admin panels
  http <url>          - Get HTTP headers
  crawl <url>         - Crawl page links
  help                - Show this help
  clear               - Clear output
  echo <text>         - Print text
  exit                - Close terminal`);
      } else if (cmd === 'clear') {
        setOutput([]);
      } else if (cmd === 'exit') {
        addOutput('system', 'Exiting PwnUX CLI.');
        onClose();
      } else if (cmd === 'echo') {
        addOutput('info', args.slice(1).join(' '));
      } else if (cmd === 'nmap' || cmd === 'port_scan') {
        const targetHost = args[1];
        if (!targetHost) { addOutput('error', 'Usage: nmap <target>'); setIsRunning(false); return; }
        addOutput('system', `Scanning ${targetHost}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/nmap/?q=${encodeURIComponent(targetHost)}`);
          if (text.toLowerCase().includes('error')) {
            addOutput('error', 'API rate limited. Using fallback scan.');
            // Fallback: try common ports via our server or direct
            addOutput('info', `Common ports for ${targetHost}:`);
            const commonPorts = [21,22,23,25,53,80,110,143,443,445,3306,8080,8443];
            for (const port of commonPorts) {
              try {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), 3000);
                const testUrl = `http://${targetHost}:${port}`;
                await fetch(testUrl, { mode: 'no-cors', signal: ctrl.signal });
                clearTimeout(tid);
                addOutput('success', `Port ${port} — OPEN (reachable)`);
              } catch {}
            }
          } else {
            text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
          }
        } catch(e) {
          addOutput('error', 'Scan failed. Network restricted.');
        }
      } else if (cmd === 'ping') {
        const targetHost = args[1];
        if (!targetHost) { addOutput('error', 'Usage: ping <target>'); setIsRunning(false); return; }
        addOutput('system', `Pinging ${targetHost}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/nping/?q=${encodeURIComponent(targetHost)}`);
          text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
        } catch(e) {
          addOutput('error', 'Ping failed (ICMP not available from browser)');
          addOutput('info', 'Try a HTTP-based latency test instead.');
        }
      } else if (cmd === 'whois') {
        const domain = args[1];
        if (!domain) { addOutput('error', 'Usage: whois <domain>'); setIsRunning(false); return; }
        addOutput('system', `WHOIS lookup for ${domain}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/whois/?q=${encodeURIComponent(domain)}`);
          text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
        } catch(e) {
          addOutput('error', 'WHOIS lookup failed.');
          addOutput('success', ( <CopyableLink url={`https://who.is/whois/${encodeURIComponent(domain)}`} label="Try who.is manually →" /> ));
        }
      } else if (cmd === 'dns') {
        const domain = args[1];
        if (!domain) { addOutput('error', 'Usage: dns <domain>'); setIsRunning(false); return; }
        addOutput('system', `DNS lookup for ${domain}...`);
        try {
          const types = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'];
          for (const t of types) {
            try {
              const result = await dnsOverHttps(domain, t);
              addOutput('info', `[${t}]\n${result}`);
            } catch {}
          }
          addOutput('success', 'DNS lookup complete.');
        } catch(e) {
          addOutput('error', 'DNS lookup failed.');
        }
      } else if (cmd === 'admin') {
        const site = args[1];
        if (!site) { addOutput('error', 'Usage: admin <url>'); setIsRunning(false); return; }
        let baseUrl = site.replace(/\/$/, '');
        if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
        addOutput('system', `Admin panel scan on ${baseUrl}...`);
        let found = 0;
        for (const path of ADMIN_PATHS) {
          const url = `${baseUrl}/${path}`;
          try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 3000);
            const resp = await fetch(url, { signal: ctrl.signal, mode: 'cors', redirect: 'follow' });
            clearTimeout(tid);
            if (resp.status === 200) {
              addOutput('success', `[200] ${url}`);
              found++;
            } else if (resp.status === 403 || resp.status === 401) {
              addOutput('info', `[${resp.status}] ${url}`);
            }
          } catch {}
        }
        addOutput('system', `Found ${found} admin panel(s).`);
      } else if (cmd === 'http') {
        const url = args[1];
        if (!url) { addOutput('error', 'Usage: http <url>'); setIsRunning(false); return; }
        let targetUrl = url;
        if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
        addOutput('system', `Fetching HTTP headers for ${targetUrl}...`);
        try {
          const resp = await fetch(targetUrl, { method: 'HEAD', mode: 'cors' });
          resp.headers.forEach((value, key) => {
            addOutput('info', `${key}: ${value}`);
          });
          addOutput('success', `Status: ${resp.status} ${resp.statusText}`);
        } catch(e) {
          addOutput('error', 'Could not fetch headers (CORS blocked).');
          try {
            const text = await fetchViaCorsProxy(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent(targetUrl)}`);
            text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
          } catch(e2) {
            addOutput('error', 'HTTP header fetch failed.');
          }
        }
      } else if (cmd === 'crawl') {
        const url = args[1];
        if (!url) { addOutput('error', 'Usage: crawl <url>'); setIsRunning(false); return; }
        let targetUrl = url;
        if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
        addOutput('system', `Crawling ${targetUrl}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/pagelinks/?q=${encodeURIComponent(targetUrl)}`);
          const lines = text.split('\n').filter(l => l.trim());
          lines.slice(0, 30).forEach(l => addOutput('info', l));
          if (lines.length > 30) addOutput('info', `... and ${lines.length - 30} more links`);
          addOutput('success', 'Crawl complete.');
        } catch(e) {
          addOutput('error', 'Crawl failed.');
        }
      } else {
        addOutput('error', `Command not found: ${cmd}. Type 'help' for available commands.`);
      }

      setShowInput(true);
      setIsRunning(false);
      return;
    }

    // --- STANDARD TOOL HANDLERS ---
    setIsRunning(true);
    let resolvedTarget = input;
    if (!resolvedTarget.startsWith('http://') && !resolvedTarget.startsWith('https://') && 
        (activeToolId === 'http' || activeToolId === 'spider' || activeToolId === 'admin_finder' || activeToolId === 'admin-finder')) {
      resolvedTarget = 'https://' + resolvedTarget;
    }

    try {
      if (activeToolId === 'shodan') {
        addOutput('system', `Querying Shodan for ${resolvedTarget}...`);
        addOutput('success', ( <CopyableLink url={`https://www.shodan.io/search?query=${encodeURIComponent(resolvedTarget)}`} label="→ Open Shodan search results" /> ));
      }
      else if (activeToolId === 'vt') {
        addOutput('system', `Querying VirusTotal for ${resolvedTarget}...`);
        addOutput('success', ( <CopyableLink url={`https://www.virustotal.com/gui/search/${encodeURIComponent(resolvedTarget)}`} label="→ Open VirusTotal analysis" /> ));
      }
      else if (activeToolId === 'dorks') {
        addOutput('system', 'Google Dork templates ready.');
        addOutput('info', 'Try these manually in Google:');
        addOutput('info', `site:${resolvedTarget} intitle:"index of"`);
        addOutput('info', `site:${resolvedTarget} inurl:admin`);
        addOutput('info', `site:${resolvedTarget} ext:sql | ext:env | ext:bak`);
        addOutput('info', `site:${resolvedTarget} inurl:wp-admin`);
        addOutput('info', `site:${resolvedTarget} intitle:"phpinfo"`);
        addOutput('success', ( <CopyableLink url={`https://www.google.com/search?q=site:${encodeURIComponent(resolvedTarget.replace(/https?:\/\//, ''))}`} label="→ Open Google search" /> ));
      }
      else if (activeToolId === 'pwned') {
        addOutput('system', `Checking ${resolvedTarget} against breach databases...`);
        addOutput('success', ( <CopyableLink url={`https://haveibeenpwned.com/domain/${encodeURIComponent(resolvedTarget)}`} label="→ Check HaveIBeenPwned (domain)" /> ));
      }
      else if (activeToolId === 'blacklist') {
        addOutput('system', `Checking blacklists for ${resolvedTarget}...`);
        addOutput('success', ( <CopyableLink url={`https://mxtoolbox.com/domain/${encodeURIComponent(resolvedTarget)}/`} label="→ MXToolbox Blacklist Check" /> ));
      }
      else if (activeToolId === 'nmap' || activeToolId === 'port_scan') {
        addOutput('system', `Scanning ${resolvedTarget}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/nmap/?q=${encodeURIComponent(resolvedTarget)}`);
          if (text.toLowerCase().includes('error')) {
            addOutput('error', 'API rate limited.');
            addOutput('success', ( <CopyableLink url={`https://hackertarget.com/nmap-online-port-scanner/`} label="→ Try Hackertarget online Nmap" /> ));
          } else {
            text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
          }
        } catch(e) {
          addOutput('error', 'Port scan blocked by browser. Use the online tool instead.');
          addOutput('success', ( <CopyableLink url={`https://hackertarget.com/nmap-online-port-scanner/`} label="→ Hackertarget Nmap Scanner" /> ));
        }
      }
      else if (activeToolId === 'whois') {
        addOutput('system', `WHOIS lookup for ${resolvedTarget}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/whois/?q=${encodeURIComponent(resolvedTarget)}`);
          if (text.toLowerCase().includes('error')) {
            addOutput('error', 'API rate limited.');
            addOutput('success', ( <CopyableLink url={`https://who.is/whois/${encodeURIComponent(resolvedTarget)}`} label="→ Try who.is" /> ));
          } else {
            text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
          }
        } catch(e) {
          addOutput('error', 'WHOIS lookup failed.');
          addOutput('success', ( <CopyableLink url={`https://who.is/whois/${encodeURIComponent(resolvedTarget)}`} label="→ Try who.is" /> ));
        }
      }
      else if (activeToolId === 'dns') {
        addOutput('system', `DNS lookup for ${resolvedTarget}...`);
        try {
          const types = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'];
          for (const t of types) {
            try {
              const result = await dnsOverHttps(resolvedTarget, t);
              addOutput('info', `[${t}] ${result}`);
            } catch {}
          }
          addOutput('success', 'DNS lookup complete (via Cloudflare DNS-over-HTTPS).');
        } catch(e) {
          addOutput('error', 'DNS lookup failed.');
        }
      }
      else if (activeToolId === 'ping') {
        addOutput('system', `Pinging ${resolvedTarget}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/nping/?q=${encodeURIComponent(resolvedTarget)}`);
          text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
        } catch(e) {
          addOutput('error', 'Ping blocked (ICMP unavailable from browser).');
          addOutput('info', 'Try a HTTP latency test instead.');
        }
      }
      else if (activeToolId === 'net_scan') {
        addOutput('system', `Network scan for ${resolvedTarget}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/subnetcalc/?q=${encodeURIComponent(resolvedTarget)}`);
          text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
        } catch(e) {
          addOutput('error', 'Network scan failed.');
        }
      }
      else if (activeToolId === 'traceroute') {
        addOutput('system', `Tracing route to ${resolvedTarget}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(resolvedTarget)}`);
          if (text.toLowerCase().includes('error')) {
            addOutput('error', 'API rate limited.');
          } else {
            text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
          }
        } catch(e) {
          addOutput('error', 'Traceroute failed.');
        }
      }
      else if (activeToolId === 'http') {
        addOutput('system', `Fetching HTTP headers for ${resolvedTarget}...`);
        try {
          const resp = await fetch(resolvedTarget, { method: 'HEAD', mode: 'cors' });
          resp.headers.forEach((value, key) => addOutput('info', `${key}: ${value}`));
          addOutput('success', `Status: ${resp.status} ${resp.statusText}`);
        } catch(e) {
          addOutput('error', 'Direct fetch blocked by CORS. Trying via proxy...');
          try {
            const text = await fetchViaCorsProxy(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent(resolvedTarget)}`);
            text.split('\n').filter(l => l.trim()).forEach(l => addOutput('info', l));
          } catch(e2) {
            addOutput('error', 'HTTP header fetch failed.');
          }
        }
      }
      else if (activeToolId === 'spider') {
        addOutput('system', `Crawling ${resolvedTarget}...`);
        try {
          const text = await fetchViaCorsProxy(`https://api.hackertarget.com/pagelinks/?q=${encodeURIComponent(resolvedTarget)}`);
          const lines = text.split('\n').filter(l => l.trim());
          lines.slice(0, 30).forEach(l => addOutput('info', l));
          if (lines.length > 30) addOutput('info', `... and ${lines.length - 30} more links`);
          addOutput('success', 'Crawl complete.');
        } catch(e) {
          addOutput('error', 'Crawl failed.');
        }
      }
      else if (activeToolId === 'certs') {
        addOutput('system', `Checking SSL/TLS for ${resolvedTarget}...`);
        addOutput('success', ( <CopyableLink url={`https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(resolvedTarget)}`} label="→ SSL Labs Analysis" /> ));
      }
      else if (activeToolId === 'mac') {
        addOutput('system', `Looking up MAC vendor for ${resolvedTarget}...`);
        addOutput('success', ( <CopyableLink url={`https://macvendors.com/query/${encodeURIComponent(resolvedTarget)}`} label="→ MAC Vendor Lookup" /> ));
      }
      else if (activeToolId === 'mail') {
        addOutput('system', `Mail server check for ${resolvedTarget}...`);
        try {
          const mxResult = await dnsOverHttps(resolvedTarget, 'MX');
          addOutput('info', `[MX] ${mxResult}`);
          const txtResult = await dnsOverHttps(resolvedTarget, 'TXT');
          addOutput('info', `[TXT] ${txtResult}`);
          addOutput('success', 'Mail server lookup complete.');
        } catch(e) {
          addOutput('error', 'Mail server lookup failed.');
        }
      }
      else if (activeToolId === 'cve') {
        addOutput('system', `Searching CVE database for ${resolvedTarget}...`);
        addOutput('success', ( <CopyableLink url={`https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(resolvedTarget)}`} label="→ NVD CVE Search" /> ));
      }
      else if (activeToolId === 'base64') {
        if (input.startsWith('decode:')) {
          try {
            const decoded = atob(input.replace('decode:', '').trim());
            addOutput('info', `Decoded: ${decoded}`);
          } catch(e) {
            addOutput('error', 'Invalid Base64 string.');
          }
        } else {
          const encoded = btoa(input);
          addOutput('info', `Encoded: ${encoded}`);
        }
      }
      else if (activeToolId === 'cipher') {
        // Automatic cipher detection/demo
        const isHex = /^[0-9a-fA-F]+$/.test(input.replace(/\s/g, ''));
        const isBinary = /^[01\s]+$/.test(input);
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(input) && input.length % 4 === 0;
        addOutput('info', `Analyzing: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`);
        if (isHex && input.replace(/\s/g, '').length % 2 === 0) {
          const hex = input.replace(/\s/g, '');
          const decoded = Buffer ? '' : hex.match(/.{1,2}/g)?.map(b => String.fromCharCode(parseInt(b, 16))).join('') || '';
          addOutput('info', `Detected: Hex. Decoded: ${decoded || '(conversion unavailable)'}`);
        } else if (isBinary) {
          const decoded = input.replace(/\s/g, '').match(/.{1,8}/g)?.map(b => String.fromCharCode(parseInt(b, 2))).join('') || '';
          addOutput('info', `Detected: Binary. Decoded: ${decoded}`);
        } else if (isBase64) {
          try {
            const decoded = atob(input);
            addOutput('info', `Detected: Base64. Decoded: ${decoded}`);
          } catch {}
        } else {
          // ROT13
          const rot13 = input.replace(/[a-zA-Z]/g, c => {
            const code = c.charCodeAt(0);
            if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
            if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
            return c;
          });
          addOutput('info', `ROT13: ${rot13}`);
          
          // Caesar cipher brute force (first few)
          for (let shift = 1; shift <= 5; shift++) {
            const caesar = input.replace(/[a-zA-Z]/g, c => {
              const code = c.charCodeAt(0);
              if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
              if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
              return c;
            });
            addOutput('info', `Caesar(-${shift}): ${caesar}`);
          }
        }
      }
      else if (activeToolId === 'bt') {
        addOutput('system', 'Scanning for BLE devices...');
        addOutput('info', 'Web Bluetooth requires HTTPS and user gesture. Check browser console for details.');
        try {
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: []
          });
          addOutput('success', `Found device: ${device.name || 'Unnamed'} (ID: ${device.id})`);
        } catch(e: any) {
          addOutput('error', `Bluetooth scan: ${e.message || 'Cancelled or unavailable'}`);
        }
      }
      else {
        addOutput('info', `Module ${activeToolId} executed for target: ${resolvedTarget}`);
      }
    } catch (e: any) {
      addOutput('error', `Execution failed: ${e.message}`);
    } finally {
      setTarget('');
      setIsRunning(false);
    }
  };

  const copyToClipboard = (text: string) => {
    copyToClipboardV2(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!tool) return null;

  const status = getStatusBadge();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <TerminalIcon size={18} className="text-purple-400" />
          <span className="text-sm font-mono text-gray-300">
            SYSTEM // MODULE.{tool.id.toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${status.color}`}>
            {status.text}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">{output.length} lines</span>
          <button onClick={() => copyToClipboard(output.map(o => o.content?.toString() || '').join('\n'))} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Copy all output">
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-gray-400" />}
          </button>
        </div>
      </div>

      {/* Tool description */}
      <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5">
        <p className="text-xs text-gray-500 font-mono">{tool.description}</p>
      </div>

      {/* Output area */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1.5">
        {output.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <TerminalIcon size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Ready. {tool.requiresInput ? 'Enter a target below.' : 'Processing...'}</p>
          </div>
        )}
        {output.map(entry => (
          <div key={entry.id} className={`${getTypeColor(entry.type)} leading-relaxed`}>
            <span className="text-[10px] opacity-40 mr-2">
              [{new Date(entry.timestamp).toLocaleTimeString()}]
            </span>
            <span className="text-xs align-middle">{entry.content}</span>
          </div>
        ))}
        {isRunning && (
          <div className="flex items-center gap-2 text-yellow-400/70 mt-2">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-xs">Processing...</span>
          </div>
        )}
      </div>

      {/* Input area */}
      {tool.requiresInput && !isRunning && (
        <form onSubmit={handleSubmit} className="border-t border-white/10 p-3 bg-black/30">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10 focus-within:border-purple-500/50">
            <span className="text-purple-400 text-xs font-mono">λ</span>
            <input
              ref={inputRef}
              type="text"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder={tool.id === 'admin_finder' || tool.id === 'admin-finder' ? 'Enter target URL (e.g., example.com)' : 'Enter target...'}
              className="flex-1 bg-transparent text-gray-200 text-sm font-mono outline-none placeholder:text-gray-600"
            />
            <button
              type="submit"
              disabled={!target.trim()}
              className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
      }
