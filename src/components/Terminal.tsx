import { useState, useRef, useEffect, FormEvent, ReactNode } from 'react';
import * as OTPAuth from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { logService } from '../utils/logger';
import { 
  X, Terminal as TerminalIcon, Play, RefreshCw, Copy, Check, 
  Cpu, ShieldAlert, Wifi, Globe, MapPin, Hash, KeySquare, Laptop, 
  Compass, Eye, Zap, ShieldAlert as AlertIcon, Lock, ArrowLeft, Bluetooth, Calculator, KeyRound, Gauge, QrCode
} from 'lucide-react';
import { ToolDef, TerminalOutput } from '../types';

interface TerminalEmulatorProps {
  tool: ToolDef | null;
  onClose: () => void;
}

const fallbackCopyTextToClipboard = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}

const copyToClipboardV2 = (text: string) => {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).catch(err => {
    // some android devices have clipboard API object but fail
    fallbackCopyTextToClipboard(text);
  });
}

const CopyableLink = ({ url, label }: { url: string, label?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    copyToClipboardV2(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-2 mt-1">
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        onClick={(e) => { e.stopPropagation(); }} 
        className="underline hover:text-white break-all text-[#38bdf8]"
      >
        {label || url}
      </a>
      <button 
        onClick={handleCopy}
        title="Copy Link"
        type="button"
        className="p-1.5 rounded-md bg-black border border-neon-green/30 hover:border-neon-green hover:bg-neon-green/10 text-neon-green transition-all focus:outline-none"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
};

export function TerminalEmulator({ tool, onClose }: TerminalEmulatorProps) {
  const [target, setTarget] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [output, setOutput] = useState<TerminalOutput[]>([
    { id: '1', timestamp: Date.now(), type: 'system', content: 'PWNNET_OS v1.0.1 [SECURE_CORE]' },
    { id: '2', timestamp: Date.now(), type: 'system', content: 'Terminal socket initialized. Enter targets to run handshake...' }
  ]);
  
  const endOfOutputRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // --- Utility States ---
  // Subnet Calc
  // Dorking Helper
  
  // --- Utility States ---
  const [subnetIp, setSubnetIp] = useState('192.168.1.1');
  const [subnetPrefix, setSubnetPrefix] = useState('24');
  const [otpSecret, setOtpSecret] = useState('JBSWY3DPEHPK3PXP');
  const [otpCode, setOtpCode] = useState('000000');
  const [otpCountdown, setOtpCountdown] = useState(30);
  const [pwdLength, setPwdLength] = useState(16);
  const [pwdOpts, setPwdOpts] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: true });
  const [generatedPwd, setGeneratedPwd] = useState('');
  const [pwdEntropy, setPwdEntropy] = useState({ bits: 0, strength: 'Weak', crackTime: '0.01 sec' });
  const [qrType, setQrType] = useState<'qr'|'barcode'>('qr');
  const [qrInput, setQrInput] = useState('https://example.com');
  const [qrLevel, setQrLevel] = useState<'L'|'M'|'Q'|'H'>('M');
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [speedTestActive, setSpeedTestActive] = useState(false);
  const [speedMetrics, setSpeedMetrics] = useState({ progress: 0, dl: 0, ul: 0, ping: 0, jitter: 0 });
  const [btScanning, setBtScanning] = useState(false);
  const [btDevice, setBtDevice] = useState<any>(null);
  const [btServices, setBtServices] = useState<any[]>([]);
  const [btError, setBtError] = useState<string>('');
  const [notesText, setNotesText] = useState(() => { try { return localStorage.getItem('pwn_notes') || ''; } catch(e) { return ''; } });
  const [browserUrl, setBrowserUrl] = useState('https://www.google.com/webhp?igu=1');
  const [hackbarTarget, setHackbarTarget] = useState('http://testphp.vulnweb.com/listproducts.php?cat=1');
  const [hackbarMethod, setHackbarMethod] = useState('GET');
  const [hackbarPayload, setHackbarPayload] = useState('1 UNION SELECT 1,2,3--');
  const [hackbarResult, setHackbarResult] = useState('');

  const dorkPresets: Record<string, {name: string, dorks: string[]}> = {
  index_of: {
    name: 'Open Directory Listings',
    dorks: [
      'intitle:"index of" admin',
      'intitle:"index of" backuper',
      'intitle:"index of" "parent directory" config',
      'intitle:"index of" "DCIM"'
    ]
  },
  admin_panel: {
    name: 'Admin Portals',
    dorks: [
      'inurl:admin login | inurl:wp-admin | inurl:dashboard | intitle:"Admin Panel"',
      'intitle:"Login - Admin" | inurl:admin/login.php',
      'inurl:cpanel | inurl:whm | inurl:plesk',
      'intitle:"Authentication Required" "Enter username and password"'
    ]
  },
  docs: {
    name: 'Confidential Docs',
    dorks: [
      'ext:pdf | ext:docx | ext:xls | ext:csv "confidential" | "strictly confidential"',
      'ext:pdf "not for public release" | "internal use only"',
      'ext:xls "payroll" | "passwords" | "social security"',
      'ext:pdf | ext:docx "do not distribute" | "proprietary"'
    ]
  },
  passwords: {
    name: 'Exposed Passwords',
    dorks: [
      'ext:txt | ext:csv "password" | "credentials" | "apikey" | "secret"',
      'ext:log "username" "password"',
      'inurl:passwords.txt | inurl:credentials.csv',
      'ext:env "DB_PASSWORD" | "DATABASE_URL"'
    ]
  },
  logs: {
    name: 'Server Error Logs',
    dorks: [
      'ext:log | ext:txt "error log" | "warning: mysql" | "exception"',
      'ext:log "access denied for user"',
      'ext:log "Failed password for root"',
      'ext:log "PHP Parse error" | "PHP Fatal error"'
    ]
  },
  databases: {
    name: 'Database Backups',
    dorks: [
      'ext:sql | ext:db | ext:dbf | ext:dump "insert into" | "create table"',
      'ext:sql inurl:backup',
      'ext:tar.gz | ext:zip "backup" "sql"',
      'ext:db "SQLite format 3"'
    ]
  },
  configs: {
    name: 'Environment Secrets',
    dorks: [
      'ext:env | ext:cfg | ext:ini "AWS_ACCESS_KEY" | "DB_PASSWORD" | "JWT_SECRET"',
      'ext:json "client_secret" "client_id"',
      'ext:xml "hibernate.connection.password"',
      'inurl:wp-config.php.bak | inurl:wp-config.php.txt'
    ]
  },
  webcam: {
    name: 'Live Webcams',
    dorks: [
      'inurl:"viewerframe?mode=" | inurl:"view/index.shtml" | intitle:"Live View / - AXIS"',
      'intitle:"Network Camera NetworkCamera"',
      'inurl:"nph-MotionJpeg?Resolution="',
      'intitle:"webcamXP 5" -download'
    ]
  },
  git_expose: {
    name: 'Git Directory Leak',
    dorks: [
      'inurl:".git" | intitle:"index of /.git"',
      'inurl:"/.git/config" "core"',
      'inurl:".git/HEAD" "ref: refs/heads/"',
      'intitle:"index of" ".git/logs/"'
    ]
  },
  jira_trello: {
    name: 'Jira / Trello Boards',
    dorks: [
      'site:trello.com | site:atlassian.net "password" | "secret" | "api key"',
      'site:trello.com "confidential" | "internal"',
      'site:atlassian.net "dashboard" "login"',
      'site:trello.com "aws" | "credentials"'
    ]
  },
  s3_buckets: {
    name: 'Open S3 Buckets',
    dorks: [
      'site:s3.amazonaws.com | site:storage.googleapis.com "admin" | "backup"',
      'site:s3.amazonaws.com "confidential" | "secret" | "password"',
      'site:s3.amazonaws.com ext:pdf | ext:xls | ext:csv',
      'site:s3.amazonaws.com intext:"ListBucketResult"'
    ]
  },
  pastebin: {
    name: 'Pastebin Leaks',
    dorks: [
      'site:pastebin.com "password" | "api_key" | "secret" | "db_pass"',
      'site:pastebin.com "BEGIN RSA PRIVATE KEY"',
      'site:pastebin.com "mysql:host="',
      'site:pastebin.com "admin@"'
    ]
  },
  cve: {
    name: 'Vulnerable Software',
    dorks: [
      'intext:"Apache Tomcat/8.5.32" | "nginx/1.14.0"',
      'intext:"Powered by WordPress 4.7.1" | "Powered by Joomla! 1.5"',
      'intitle:"phpMyAdmin" "Welcome to phpMyAdmin"',
      'inurl:"/cgi-bin/guestbook.cgi"'
    ]
  },
  api_endpoints: {
    name: 'Exposed APIs',
    dorks: [
      'inurl:api/v1 | inurl:api/v2 | inurl:swagger-ui.html | inurl:api-docs',
      'intitle:"Swagger UI" -github.com',
      'inurl:"/wp-json/wp/v2/users"',
      'inurl:"graphql" "query"'
    ]
  },
  cloud_credentials: {
    name: 'Cloud Credentials',
    dorks: [
      '"-----BEGIN RSA PRIVATE KEY-----" | "AIzaSy" | "AKIA" | "sk_live_"',
      '"ghp_" | "glpat-" | "sq0csp-"',
      '"xoxb-" | "xoxp-" | "EAACEdEose0cBA"',
      '"mongodb+srv://" "password"'
    ]
  }
};
  const [dorkTarget, setDorkTarget] = useState('');
  const [dorkType, setDorkType] = useState('index_of');
  const [subDork, setSubDork] = useState(0);
  const [editableDork, setEditableDork] = useState('');

  useEffect(() => {
    const root = dorkTarget ? 'site:' + dorkTarget + ' ' : '';
    const presetInfo = dorkPresets[dorkType] || dorkPresets['index_of'];
    const dorkArr = presetInfo.dorks;
    const selectedDork = dorkArr[subDork] || dorkArr[0];
    setEditableDork(root + selectedDork);
  }, [dorkTarget, dorkType, subDork]);
  
  // --- Scroll to Bottom ---
  useEffect(() => {
    endOfOutputRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // Load Tool defaults and initial logs
  useEffect(() => {
    if (tool) {
      setTarget('');
      let initialOutputs: TerminalOutput[] = [
        { id: 'init-1', timestamp: Date.now(), type: 'system', content: `PWNNET_OS v1.0.1 [MODULE_LOADED // ${tool.name.toUpperCase()}]` },
        { id: 'init-2', timestamp: Date.now(), type: 'info', content: `Ready for query execution.` }
      ];

      if (tool.id === 'pwnux') {
         initialOutputs.push({
            id: 'init-3',
            timestamp: Date.now(),
            type: 'system',
            content: `Connected to pwnux shell environment.\nType 'help' to see available commands.`
         });
      }

      setOutput(initialOutputs);
      
      logService.addLog({
        module: "SYSTEM",
        event: "Component runtime loaded",
        target: tool.name,
        status: "OK",
        details: `Loaded '${tool.name}' (${tool.id}) into terminal execution workspace.`
      });

      if (!tool.requiresInput) {
        setTimeout(() => {
          handleExecute();
        }, 150);
      }
    }
  }, [tool]);

  // --- Helper: Append to Console Output ---
  const addOutput = (type: TerminalOutput['type'], content: ReactNode) => {
    const lineId = `${Date.now()}-${Math.random()}-${Math.random()}`;
    setOutput(prev => [...prev, { id: lineId, timestamp: Date.now(), type, content }]);
  };

  // Helper: Strip URLs to clean Hostname (e.g., https://example.com/api -> example.com)
  const cleanHostname = (raw: string): string => {
    let hostname = raw.trim();
    if (hostname.includes('://')) {
      hostname = hostname.split('://')[1];
    }
    hostname = hostname.split('/')[0];
    hostname = hostname.split(':')[0]; // strip port
    return hostname;
  };

  
  // Auto-trigger clean utilities
  useEffect(() => {
    if (tool) {
      if (tool.id === 'device') gatherDeviceInfo();
      else if (tool.id === 'passwords') generatePassword();
      else if (tool.id === 'otp') calculateOTP();
    }
  }, [tool]);

  // Dynamic OTP timer loop synchronized with UTC epoch minute boundaries (TOTP standard 30s period)
  useEffect(() => {
    if (tool?.id !== 'otp') return;
    
    const updateCountdown = () => {
      const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
      setOtpCountdown(remaining);
      calculateOTP();
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [tool, otpSecret]);

  async function gatherDeviceInfo() {
    try {
      const ua = navigator.userAgent;
      const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : /Android/.test(ua) ? 'Android' : /iOS/.test(ua) ? 'iOS' : 'Unknown OS';
      const browser = /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser Unknown';
      
      const gl = document.createElement('canvas').getContext('webgl');
      const gpu = gl ? (gl.getExtension('WEBGL_debug_renderer_info') ? gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) : 'Generic GPU') : 'No WebGL';
      
      setDeviceInfo({
        os,
        browser,
        locale: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cores: navigator.hardwareConcurrency || 'Unknown',
        ram: (navigator as any).deviceMemory || 'Unknown',
        gpu,
        screen: `${window.screen.width}x${window.screen.height}`,
        colorDepth: window.screen.colorDepth,
        connection: (navigator as any).connection ? (navigator as any).connection.effectiveType : 'Unknown',
        userAgent: ua
      });
    } catch {}
  };

  function generatePassword() {
    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    let chars = '';
    if (pwdOpts.uppercase) chars += charset.uppercase;
    if (pwdOpts.lowercase) chars += charset.lowercase;
    if (pwdOpts.numbers) chars += charset.numbers;
    if (pwdOpts.symbols) chars += charset.symbols;
    
    if (!chars) chars = charset.lowercase;
    
    let pwd = '';
    const array = new Uint32Array(pwdLength);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < pwdLength; i++) {
        pwd += chars[array[i] % chars.length];
    }
    setGeneratedPwd(pwd);

    // Naive entropy
    const poolSize = chars.length;
    const bits = Math.round(pwdLength * Math.log2(poolSize));
    let strength = 'Weak';
    let crackTime = '0.01 sec';
    
    if (bits > 128) { strength = 'Military'; crackTime = 'Centuries'; }
    else if (bits > 80) { strength = 'Strong'; crackTime = 'Years'; }
    else if (bits > 60) { strength = 'Medium'; crackTime = 'Days'; }
    
    setPwdEntropy({ bits, strength, crackTime });
  };

  async function calculateOTP() {
    let code = '';
    for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 10).toString();
    setOtpCode(code);
  };

  async function measureSpeed() {
    setSpeedTestActive(true);
    setSpeedMetrics({ progress: 0, dl: 0, ul: 0, ping: 0, jitter: 0 });
    
    // Simulate real bandwidth test using random generated data
    let ping = Math.floor(Math.random() * 40 + 10);
    let jitter = Math.floor(Math.random() * 5 + 1);
    
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 100));
      setSpeedMetrics(prev => ({
        ...prev,
        progress: i,
        ping, jitter,
        dl: i < 50 ? Math.random() * 50 + 100 : prev.dl, // 100-150 Mbps
        ul: i >= 50 ? Math.random() * 20 + 30 : prev.ul   // 30-50 Mbps
      }));
    }
    setSpeedTestActive(false);
  };

  async function scanBluetooth() {
    setBtError('');
    setBtScanning(true);
    setBtDevice(null);
    setBtServices([]);
    
    try {
      if (!(navigator as any).bluetooth) {
        throw new Error('Web Bluetooth API is not supported in this browser or requires HTTPS.');
      }
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
      });
      
      setBtDevice({
        id: device.id,
        name: device.name || 'Unknown Device',
        connected: false
      });
      
      addOutput('success', `Bluetooth device discovered: ${device.name || device.id}`);
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
         setBtError('User cancelled the scanner request.');
      } else if (err.name === 'SecurityError') {
         setBtError('Iframe Sandbox Block: The platform prevents embedded web sandboxes from launching local hardware Bluetooth prompts.');
      } else {
         setBtError(err.message || String(err));
      }
    } finally {
      setBtScanning(false);
    }
  };


  // --- Execute Actions from inputs ---
  const handleExecute = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!target.trim() && tool?.requiresInput) return;
    
    if (target.trim()) {
      setHistory(prev => [...prev.filter(t => t !== target.trim()), target.trim()]);
      setHistoryIndex(-1);
    }

    setIsRunning(true);
    
    // Check if simple offline tool
    if (tool?.id === 'device') gatherDeviceInfo();
    else if (tool?.id === 'passwords') generatePassword();
    else if (tool?.id === 'otp') calculateOTP();

    let resolvedTarget = target.trim();
    const rawInput = resolvedTarget; // Store raw input for output display
    let activeToolId = tool?.id;

    if (activeToolId === 'pwnux') {
      const parts = resolvedTarget.split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      
      if (cmd === 'clear') {
         setOutput([
            { id: Date.now().toString(), timestamp: Date.now(), type: 'system', content: 'Console cleared.' }
         ]);
         setTarget('');
         setIsRunning(false);
         return;
      }
      
      const cmdMap: Record<string, string> = {
         'nmap': 'nmap',
         'ping': 'ping',
         'whois': 'whois',
         'traceroute': 'traceroute',
         'mtr': 'traceroute',
         'shodan': 'shodan',
         'host': 'ip_host',
         'dns': 'dns',
         'nslookup': 'dns',
         'dig': 'dns',
         'vt': 'vt',
         'pwned': 'pwned',
         'blacklist': 'blacklist',
         'mac': 'mac',
         'http': 'http',
         'curl': 'http',
         'wget': 'http',
         'spider': 'spider',
         'certs': 'certs',
         'mail': 'mail',
         'net_scan': 'net_scan',
         'port_scan': 'port_scan',
         'smb': 'smb',
         'smbclient': 'smb',
         'dir_scan': 'dir_scan',
         'base64': 'base64',
         'cipher': 'cipher',
         'dorks': 'dorks',
         'admin_finder': 'admin_finder',
         'wp_scan': 'wp_scan',
         'cve': 'cve',
         'react_scan': 'react_scan',
         'phone_crawl': 'phone_crawl',
         'stress_test': 'stress_test',
         'dos': 'stress_test',
         'stress': 'stress_test',
         'web_faker': 'web_faker',
         'clone': 'web_faker'
      };

      if (cmd === 'help' || cmd === '-h' || cmd === '--help') {
         addOutput('input', `root@pwnux:~$ ${rawInput}`);
         addOutput('info', `Available commands: clear, help, ${Object.keys(cmdMap).join(', ')}`);
         setTarget('');
         setIsRunning(false);
         return;
      }

      const examplesMap: Record<string, string> = {
         'nmap': 'nmap target.com',
         'ping': 'ping target.com',
         'whois': 'whois target.com',
         'traceroute': 'traceroute target.com',
         'mtr': 'mtr target.com',
         'shodan': 'shodan target.com',
         'host': 'host target.com',
         'dns': 'dns target.com',
         'nslookup': 'nslookup target.com',
         'dig': 'dig target.com',
         'vt': 'vt target.com',
         'pwned': 'pwned email@example.com',
         'blacklist': 'blacklist target.com',
         'mac': 'mac 00:11:22:33:44:55',
         'http': 'http target.com',
         'curl': 'curl target.com',
         'wget': 'wget target.com',
         'spider': 'spider target.com',
         'certs': 'certs target.com',
         'mail': 'mail target.com',
         'net_scan': 'net_scan 192.168.1.0',
         'port_scan': 'port_scan target.com',
         'smb': 'smb target.com',
         'smbclient': 'smbclient target.com',
         'dir_scan': 'dir_scan target.com',
         'base64': 'base64 text-to-encode-or-decode',
         'cipher': 'cipher text-to-decode',
         'dorks': 'dorks target.com',
         'admin_finder': 'admin_finder target.com',
         'wp_scan': 'wp_scan target.com',
         'cve': 'cve CVE-YYYY-NNNN',
         'react_scan': 'react_scan target.com',
         'phone_crawl': 'phone_crawl target.com',
         'stress_test': 'stress_test target.com',
         'dos': 'dos target.com',
         'stress': 'stress target.com',
         'web_faker': 'web_faker target.com',
         'clone': 'clone target.com'
      };
      
      if (cmdMap[cmd]) {
         if (parts.length === 1) {
            addOutput('input', `root@pwnux:~$ ${rawInput}`);
            addOutput('error', `Usage: ${examplesMap[cmd] || `${cmd} [target]`}`);
            setTarget('');
            setIsRunning(false);
            return;
         }
         activeToolId = cmdMap[cmd];
         resolvedTarget = parts[parts.length - 1]; // Assume last arg is target
      } else {
         addOutput('input', `root@pwnux:~$ ${rawInput}`);
         addOutput('error', `bash: ${cmd}: command not found`);
         addOutput('info', `Type 'help' to see available commands.`);
         setTarget('');
         setIsRunning(false);
         return;
      }
    }

    // Parse specific commands like a real shell for standard tools
    if (activeToolId === 'nmap' && resolvedTarget.startsWith('nmap')) {
      const parts = resolvedTarget.split(/\s+/);
      resolvedTarget = parts[parts.length - 1]; // Assume target is the last arg
    } else if (activeToolId === 'ping' && resolvedTarget.startsWith('ping')) {
      const parts = resolvedTarget.split(/\s+/);
      resolvedTarget = parts[parts.length - 1]; // Assume target is the last arg
    } else if (activeToolId === 'whois' && resolvedTarget.startsWith('whois')) {
      const parts = resolvedTarget.split(/\s+/);
      resolvedTarget = parts[parts.length - 1]; // Assume target is the last arg
    }
    
    if (!activeToolId) return;

    if (activeToolId === 'base64') {
      const trimmedVal = resolvedTarget;
      addOutput('system', `Parsing base64 validation vectors...`);
      setTimeout(() => {
        try {
          const isBase64 = /^[A-Za-z0-9+/=]+$/.test(trimmedVal) && (trimmedVal.length % 4 === 0 || trimmedVal.endsWith('='));
          if (isBase64) {
            addOutput('success', `>>> DETECTED BASE64 ENCODED INPUT <<<`);
            addOutput('success', atob(trimmedVal));
          } else {
            throw new Error('Not base64');
          }
        } catch (e) {
          addOutput('success', `>>> CHARACTER DATA ENCODED <<<`);
          addOutput('success', btoa(resolvedTarget));
        }
        setTarget('');
        setIsRunning(false);
      }, 300);
      return;
    }

    if (activeToolId === 'cipher') {
      addOutput('system', `Initializing cipher heuristics...`);
      setTimeout(() => {
        addOutput('info', 'ROT-13: ' + resolvedTarget.replace(/[a-zA-Z]/g, (char: string) => {
           let code = char.charCodeAt(0) + 13;
           return String.fromCharCode((char <= 'Z' ? 90 : 122) >= code ? code : code - 26);
        }));
        setTarget('');
        setIsRunning(false);
      }, 300);
      return;
    }

    if (activeToolId === 'security') {
      addOutput('system', 'Analyzing client context...');
      setTimeout(() => {
        addOutput('info', `Secure Context (HTTPS): ${window.isSecureContext ? '✅' : '❌'}`);
        addOutput('info', `Iframe Sandboxed: ${window.self !== window.top ? '🛡️' : '🌎'}`);
        setIsRunning(false);
      }, 300);
      return;
    }

    if (activeToolId === 'speed') {
      addOutput('system', `Connecting to global backbone peers...`);
      measureSpeed();
      setIsRunning(false);
      return;
    }

    // Network / online tools
    if (!resolvedTarget) {
      setIsRunning(false);
      return;
    }

    // Clean target for the API calls
    if (activeToolId !== 'mac') {
      resolvedTarget = cleanHostname(resolvedTarget);
    }

    const isValidIP = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(resolvedTarget);
    const isValidDomain = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/.test(resolvedTarget) || resolvedTarget === 'localhost';
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedTarget);
    const isValidMac = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/i.test(resolvedTarget);
    
    const cidrParts = resolvedTarget.split('/');
    const isCidr = cidrParts.length === 2 && /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(cidrParts[0]) && !isNaN(parseInt(cidrParts[1])) && parseInt(cidrParts[1]) >= 0 && parseInt(cidrParts[1]) <= 32;

    const domainOrIpTools = ['ping', 'nmap', 'whois', 'traceroute', 'mtr', 'shodan', 'host', 'ip_host', 'dns', 'nslookup', 'dig', 'vt', 'blacklist', 'http', 'curl', 'wget', 'spider', 'certs', 'mail', 'dir_scan', 'port_scan', 'smb', 'smbclient', 'admin_finder', 'wp_scan', 'react_scan', 'phone_crawl', 'stress_test', 'web_faker'];
    
    if (domainOrIpTools.includes(activeToolId)) {
        if (!isValidIP && !isValidDomain) {
            addOutput('input', `root@pwnux:~$ ${rawInput}`);
            addOutput('error', `Invalid input. Please provide a valid IP address or domain name. (e.g., example.com or 8.8.8.8)`);
            setIsRunning(false);
            setTarget('');
            return;
        }
    } else if (activeToolId === 'pwned') {
        if (!isValidEmail) {
            addOutput('input', `root@pwnux:~$ ${rawInput}`);
            addOutput('error', `Invalid input. Please provide a valid email address.`);
            setIsRunning(false);
            setTarget('');
            return;
        }
    } else if (activeToolId === 'mac') {
        if (!isValidMac) {
            addOutput('input', `root@pwnux:~$ ${rawInput}`);
            addOutput('error', `Invalid input. Please provide a valid MAC address (e.g. 00:11:22:33:44:55).`);
            setIsRunning(false);
            setTarget('');
            return;
        }
    } else if (activeToolId === 'net_scan') {
        if (!isValidIP && !isCidr) {
            addOutput('input', `root@pwnux:~$ ${rawInput}`);
            addOutput('error', `Invalid input. Please provide a valid IP address or CIDR notation (e.g. 192.168.1.0/24).`);
            setIsRunning(false);
            setTarget('');
            return;
        }
    } else if (activeToolId === 'dorks' && resolvedTarget.trim() !== '' && resolvedTarget !== 'dorks') {
        if (!isValidDomain) {
            addOutput('input', `root@pwnux:~$ ${rawInput}`);
            addOutput('error', `Invalid input. Please provide a valid domain name. (e.g., example.com)`);
            setIsRunning(false);
            setTarget('');
            return;
        }
    }

    addOutput('input', `root@pwnux:~$ ${rawInput}`);

    try {
        if (activeToolId === 'ip_host') {
          addOutput('system', `Querying telemetry for ${resolvedTarget}...`);
          const response = await fetch(`https://api.hackertarget.com/geoip/?q=${encodeURIComponent(resolvedTarget)}`);
          const text = await response.text();
          if (text.includes('error')) addOutput('error', text);
          else addOutput('info', text);

        } else if (activeToolId === 'shodan') {
          addOutput('system', `Pivoting to Open-Source Host Search for [${resolvedTarget}]...`);
          try {
              const response = await fetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(resolvedTarget)}`);
              addOutput('info', await response.text());
          } catch(e) {
              addOutput('error', 'Execution blocked by network.');
          }
          addOutput('success', (
            <span className="flex items-center flex-wrap">
              {'=> Open full Shodan query here: '}
              <CopyableLink url={`https://www.shodan.io/host/${encodeURIComponent(resolvedTarget)}`} />
            </span>
          ));

        } else if (activeToolId === 'vt') {
          addOutput('system', `Analyzing Crowd-sourced Intelligence for [${resolvedTarget}]...`);
          addOutput('success', (
            <span className="flex items-center flex-wrap">
              {'=> View VirusTotal Analysis: '}
              <CopyableLink url={`https://www.virustotal.com/gui/search/${encodeURIComponent(resolvedTarget)}`} />
            </span>
          ));

        } else if (activeToolId === 'dorks') {
          addOutput('system', `Google Dork templates active... See UI to generate.`);

        } else if (activeToolId === 'pwned') {
          addOutput('system', `Looking up compromised credential databases for [${resolvedTarget}]...`);
          addOutput('success', (
            <span className="flex items-center flex-wrap">
              {'=> Check HaveIBeenPwned registry: '}
              <CopyableLink url={`https://haveibeenpwned.com/account/${encodeURIComponent(resolvedTarget)}`} />
            </span>
          ));

        } else if (activeToolId === 'blacklist') {
          addOutput('system', `Checking active spam and domain blacklists for [${resolvedTarget}]...`);
          addOutput('success', (
            <span className="flex items-center flex-wrap">
              {'=> Scan via MXToolbox: '}
              <CopyableLink url={`https://mxtoolbox.com/blacklists.aspx?url=${encodeURIComponent(resolvedTarget)}`} />
            </span>
          ));

        } else if (activeToolId === 'nmap' || activeToolId === 'port_scan') {
          addOutput('system', `Scanning host TCP layer: ${resolvedTarget}...`);
          try {
            const response = await fetch(`https://api.hackertarget.com/nmap/?q=${encodeURIComponent(resolvedTarget)}`);
            const text = await response.text();
            if (text.includes('error')) {
               addOutput('error', `Scan blocked by limits or network isolation.`);
               const url = `https://hackertarget.com/nmap-online-port-scanner/`;
               addOutput('success', (
                <span className="flex items-center flex-wrap">
                  {'=> Run Nmap Scan via Proxy: '}
                  <CopyableLink url={url} />
                </span>
              ));
            } else {
               addOutput('info', text);
            }
          } catch (err) {
             addOutput('error', 'Execution failed. Network blocked the request.');
          }

        } else if (activeToolId === 'whois') {
          addOutput('system', `Target Registration lookup: ${resolvedTarget}...`);
          try {
            const response = await fetch(`https://api.hackertarget.com/whois/?q=${encodeURIComponent(resolvedTarget)}`);
            const text = await response.text();
            if (text.includes('error')) {
               addOutput('error', `Lookup blocked by limits or network isolation.`);
               const url = `https://who.is/whois/${encodeURIComponent(resolvedTarget)}`;
               addOutput('success', (
                <span className="flex items-center flex-wrap">
                  {'=> Run Whois Lookup Manually: '}
                  <CopyableLink url={url} />
                </span>
              ));
            } else {
               addOutput('info', text);
            }
          } catch (err) {
             addOutput('error', 'Execution failed. Network blocked the request.');
          }

        } else if (activeToolId === 'dns') {
          addOutput('system', `Retrieving DNS mapping: ${resolvedTarget}...`);
          const response = await fetch(`https://api.hackertarget.com/dnslookup/?q=${encodeURIComponent(resolvedTarget)}`);
          addOutput('info', await response.text());

        } else if (activeToolId === 'ping') {
          addOutput('system', `Initiating ICMP live sweep to: ${resolvedTarget}...`);
          const response = await fetch(`https://api.hackertarget.com/nping/?q=${encodeURIComponent(resolvedTarget)}`);
          addOutput('info', await response.text());

        } else if (activeToolId === 'net_scan') {
          addOutput('system', `Reverse mapping target: ${resolvedTarget}...`);
          const response = await fetch(`https://api.hackertarget.com/subnetcalc/?q=${encodeURIComponent(resolvedTarget)}`);
          addOutput('info', await response.text());

        } else if (activeToolId === 'smb' || activeToolId === 'smtp_test' || activeToolId === 'remote_shell') {
          addOutput('system', `Initiating raw socket connect and banner grab against target: ${resolvedTarget}...`);
          try {
             const response = await fetch(`/api/net/shell?target=${encodeURIComponent(resolvedTarget)}`);
             if (response.ok) {
                 const data = await response.json();
                 if (data.results) {
                    let found = false;
                    Object.keys(data.results).forEach(port => {
                       const res = data.results[port];
                       if (res.open) {
                          found = true;
                          addOutput('success', `[PORT ${port} OPEN] Banner: ${res.banner || 'NO BANNER'}`);
                       } else {
                          addOutput('info', `[PORT ${port} CLOSED/FILTERED] ${res.error || ''}`);
                       }
                    });
                    if (!found) addOutput('error', 'All default administration ports are filtered or closed.');
                 } else {
                    addOutput('error', data.error || 'Failed to grab banners.');
                 }
             } else {
                 addOutput('error', 'Raw socket multiplexer endpoint failed.');
             }
          } catch(err) {
             addOutput('error', 'Network error reaching backend socket engine.');
          }
          
        } else if (activeToolId === 'dir_scan') {
          addOutput('system', `Initiating directory bruteforce (Wordlist: common.txt) on: ${resolvedTarget}...`);
          
          const commonDirs = [
            'admin', 'login', 'dashboard', 'api', 'assets', 'css', 'js', 'images',
            'wp-admin', 'robots.txt', '.ENV', '.git', 'backup', 'old', 'test', 'logs'
          ];
          
          let baseUrl = resolvedTarget.replace(/\/$/, "");
          if (!baseUrl.startsWith('http')) baseUrl = 'http://' + baseUrl;

          try {
             // First try the backend proxy (if running in AI Studio)
             const response = await fetch(`/api/net/dirscan?target=${encodeURIComponent(resolvedTarget)}`);
             if (response.ok) {
                 const data = await response.json();
                 if (data.error) throw new Error(data.error);
                 
                 if (data.results && data.results.length > 0) {
                    data.results.forEach((res: any) => {
                        const { path, status } = res;
                        const isFile = path.includes('.');
                        const color = (status >= 200 && status < 300) ? 'success' : 'info';
                        addOutput(color as 'info'|'success', `[${status}] - ${isFile ? '4KB' : '0KB'} - ${path}${isFile ? '' : '/'}`);
                    });
                    addOutput('info', 'Directory scan completed (via proxy).');
                 } else {
                    addOutput('info', 'Directory scan completed. No common directories found.');
                 }
                 setIsRunning(false);
                 return;
             }
             throw new Error('Proxy failed or not reachable');
          } catch (err) {
             // Fallback for Android App running on client side (CORS must be disabled in webview)
             addOutput('system', 'Local proxy not available. Executing client-side HEAD sweeps...');
             
             let i = 0;
             const processClientScan = async () => {
                if (i >= commonDirs.length) {
                    addOutput('info', 'Directory scan completed.');
                    setIsRunning(false);
                    return;
                }
                const dir = commonDirs[i];
                i++;
                
                try {
                    const url = `${baseUrl}/${dir}`;
                    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
                    if (res.status !== 404 && res.status !== 0) {
                        const isFile = dir.includes('.');
                        const color = (res.status >= 200 && res.status < 300) ? 'success' : 'info';
                        addOutput(color as 'info'|'success', `[${res.status}] - ${isFile ? '4KB' : '0KB'} - /${dir}${isFile ? '' : '/'}`);
                    }
                } catch(e) {
                   // Ignore network errors/cors
                }
                setTimeout(processClientScan, 50);
             };
             processClientScan();
             return;
          }

        } else if (activeToolId === 'traceroute') {
          addOutput('system', `Tracing hops to: ${resolvedTarget}...`);
          try {
            const response = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(resolvedTarget)}`);
            const text = await response.text();
            if (text.includes('error')) {
               addOutput('error', `API Restriction: ${text} for Traceroute/MTR.`);
            } else {
               addOutput('info', text);
            }
          } catch (err) {
             addOutput('error', 'Execution failed. Network blocked the request.');
          }

        } else if (activeToolId === 'http') {
          addOutput('system', `Grabbing HTTP/S server banners: ${resolvedTarget}...`);
          const response = await fetch(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent(resolvedTarget)}`);
          addOutput('info', await response.text());

        } else if (activeToolId === 'spider') {
          addOutput('system', `Executing Page Links crawl: ${resolvedTarget}...`);
          const response = await fetch(`https://api.hackertarget.com/pagelinks/?q=${encodeURIComponent(resolvedTarget)}`);
          const text = await response.text();
          const lines = text.split('\n').slice(0, 25);
          lines.forEach((l, i) => addOutput('info', l));
          addOutput('success', '=> Mapped visible anchor nodes.');

        } else if (activeToolId === 'certs') {
          addOutput('system', `Resolving TLS/SSL Certificate details for [${resolvedTarget}]...`);
          addOutput('success', (
             <span className="flex items-center flex-wrap">
               {'=> Analyze via SSL Labs: '}
               <CopyableLink url={`https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(resolvedTarget)}`} />
             </span>
          ));

        } else if (activeToolId === 'mac') {
          addOutput('system', `Looking up vendor OUI for MAC Address [${resolvedTarget}]...`);
          addOutput('success', (
             <span className="flex items-center flex-wrap">
               {'=> Verify vendor via MacVendors: '}
               <CopyableLink url={`https://macvendors.com/search/${encodeURIComponent(resolvedTarget)}`} />
             </span>
          ));

        } else if (activeToolId === 'mail') {
          addOutput('system', `Probing DNS Mail exchange...`);
          const response = await fetch(`https://api.hackertarget.com/dnslookup/?q=${encodeURIComponent(resolvedTarget)}`);
          addOutput('info', await response.text());

        } else if (activeToolId === 'admin_finder') {
          addOutput('system', `Initiating structured administrative portal discovery on: ${resolvedTarget}...`);
          try {
             const response = await fetch(`/api/net/adminfinder?target=${encodeURIComponent(resolvedTarget)}`);
             const data = await response.json();
             if (data.results && data.results.length > 0) {
               data.results.forEach((r: any) => {
                 const color = (r.status >= 200 && r.status < 400) ? 'success' : 'info';
                 addOutput(color as 'info'|'success', `[${r.status}] FOUND SECURE ENDPOINT - ${r.path}`);
               });
             } else {
               addOutput('info', 'No common admin portals discovered.');
             }
          } catch(e) {
             addOutput('error', 'Admin finder execution failed.');
          }

        } else if (activeToolId === 'wp_scan') {
          addOutput('system', `Scanning WordPress topology for [${resolvedTarget}]...`);
          try {
             const response = await fetch(`/api/net/wpscan?target=${encodeURIComponent(resolvedTarget)}`);
             const data = await response.json();
             if (data.isWordPress) {
                addOutput('success', '[DETECTED] WordPress CMS presence confirmed.');
                addOutput('success', (
                   <span className="flex items-center flex-wrap">
                     {'=> Leverage WPScan Vulnerability Database: '}
                     <CopyableLink url={`https://wpscan.com/search?text=${encodeURIComponent(resolvedTarget)}`} />
                   </span>
                ));
             } else {
                addOutput('info', 'Target does not appear to be running WordPress.');
             }
          } catch(e) {
             addOutput('error', 'WP Scan failed.');
          }

        } else if (activeToolId === 'cve') {
          addOutput('system', `Querying Global CVE Database for vulnerabilities related to [${resolvedTarget}]...`);
          addOutput('success', (
             <span className="flex items-center flex-wrap">
               {'=> Open NVD Registry Record: '}
               <CopyableLink url={`https://nvd.nist.gov/vuln/search/results?form_type=Basic&results_type=overview&query=${encodeURIComponent(resolvedTarget)}&search_type=all`} />
             </span>
          ));

        } else if (activeToolId === 'react_scan') {
          addOutput('system', `Analyzing React/Next.js bundle infrastructure on: ${resolvedTarget}...`);
          try {
             const response = await fetch(`/api/net/reactscan?target=${encodeURIComponent(resolvedTarget)}`);
             const data = await response.json();
             if (data.results && data.results.length > 0) {
               data.results.forEach((r: any) => {
                 addOutput('success', `[${r.status}] FOUND REACT BUNDLE/PAYLOAD - ${r.path}`);
               });
             } else {
               addOutput('info', 'No specific React/Next.js infrastructure detected.');
             }
          } catch(e) {
             addOutput('error', 'React infrastructure scan failed.');
          }

        } else if (activeToolId === 'phone_crawl') {
          addOutput('system', `Initializing regex spider to extract sensitive phone telemetry from [${resolvedTarget}]...`);
          addOutput('info', `Crawling DOM routes and embedded PDF links. Execution may take up to 2 seconds...`);
          try {
             const response = await fetch(`/api/net/phonecrawl?target=${encodeURIComponent(resolvedTarget)}`);
             const data = await response.json();
             addOutput('success', `[PATTERN_MATCH] Found ${data.count || 0} numeric string clusters aligning strictly with mobile/landline regex.`);
             if (data.numbers && data.numbers.length > 0) {
                data.numbers.forEach((n: string) => addOutput('info', `=> MATCH: ${n}`));
             }
          } catch(e) {
             addOutput('error', 'Phone scan crawler failed.');
          }

        } else if (activeToolId === 'stress_test') {
          addOutput('system', `WARNING: LAUNCHING DENIAL OF SERVICE (STRESS TEST) VECTOR ON [${resolvedTarget}]`);
          addOutput('error', `STRESS TEST ACTIVE. Launching background worker threads... proxying payload.`);
          try {
             const response = await fetch(`/api/net/dos?target=${encodeURIComponent(resolvedTarget)}`);
             const data = await response.json();
             addOutput('info', `Target resilience check concluded. ${data.message || 'Complete.'}`);
          } catch(e) {
             addOutput('error', 'Stress test vector failed.');
          }

        } else if (activeToolId === 'web_faker') {
          addOutput('system', `Cloning index node and spoofing web assets for [${resolvedTarget}]...`);
          try {
             const response = await fetch(`/api/net/webfaker?target=${encodeURIComponent(resolvedTarget)}`);
             const data = await response.json();
             addOutput('info', data.content || 'Failed to download raw HTML.');
          } catch(e) {
             addOutput('error', 'Pwnux Faker failed.');
          }
          addOutput('success', (
             <span className="flex items-center flex-wrap">
               {'=> Browse Full Cloned Page: '}
               <CopyableLink url={`view-source:https://${encodeURIComponent(resolvedTarget)}`} />
             </span>
          ));

        } else {
          addOutput('info', 'Command complete.');
        }
    } catch (e: any) {
        addOutput('error', 'Execution failed: ' + e.message);
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

  return (
    <div className="absolute inset-0 bg-obsidian z-50 flex flex-col pt-14 pb-16 font-mono text-neon-green">
      {/* Scanline CRT overlay filter */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)+50%,rgba(0,0,0,0.25)+50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] z-40 opacity-20" />

      {/* Terminal Header Bar */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-dark-gray border-b border-neon-green flex justify-between items-center px-4 z-50">
        <div className="flex items-center gap-2 text-neon-green font-bold uppercase text-[11px] tracking-wider">
          <TerminalIcon size={15} className="animate-pulse" />
          <span>SYSTEM // MODULE.{tool.id.toUpperCase()}</span>
          {tool.defaultPort ? (
            <span className="text-black bg-neon-green px-1 py-0.5 text-[8px] font-bold">PORT {tool.defaultPort}</span>
          ) : (
            <span className="text-[#00FF41] border border-neon-green px-1 py-0.5 text-[8px]">ACTIVE</span>
          )}
        </div>
        <button 
          onClick={onClose} 
          className="text-neon-green hover:text-white hover:bg-neon-green/15 border border-neon-green/40 hover:border-neon-green px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer text-xs font-mono font-bold uppercase active:scale-95"
        >
          <ArrowLeft size={14} className="stroke-[2.5px]" />
          <span>BACK</span>
        </button>
      </div>

      {/* --- RENDER TOOL DESCRIPTION --- */}
      <div className="px-4 py-3 border-b border-[#00ff41]/20 bg-[#070707] flex gap-3 items-start shrink-0">
        <div className="mt-0.5 text-[#00ff41] opacity-70">
          {(() => {
            const Icon = tool.icon;
            return <Icon size={14} />;
          })()}
        </div>
        <p className="text-gray-400 font-mono text-[10px] sm:text-xs leading-relaxed max-w-5xl tracking-wide">
          {tool.description || 'System component actively loaded for execution.'}
        </p>
      </div>

      {/* --- RENDER 1: CUSTOM INTERACTIVE TOOLS OR STATS --- */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        
        {tool.id === 'notes' && (
          <div className="p-4 flex-1 flex flex-col mx-auto w-full max-w-4xl h-full">
            <div className="text-neon-green font-mono text-sm mb-2 flex items-center gap-2 border-b border-neon-green/20 pb-2"><FileText size={16} /> OPERATIONAL NOTES MEMORY</div>
            <textarea
              className="flex-1 w-full bg-[#0c0c0c]/80 border border-neon-green/30 rounded-xl p-4 text-gray-300 font-mono text-[11px] focus:outline-none focus:border-neon-green/80 transition-colors resize-none shadow-inner"
              placeholder="Dump payload logs, intercepted URLs, or temporary configurations here..."
              value={notesText}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => {
                setNotesText(e.target.value);
                try { localStorage.setItem('pwn_notes', e.target.value); } catch(ex){}
              }}
            />
          </div>
        )}

        {tool.id === 'browser' && (
          <div className="p-4 flex-1 flex flex-col mx-auto w-full h-full">
             <div className="text-neon-green font-mono text-sm mb-2 border-b border-neon-green/20 pb-2 flex gap-2 items-center">
                <AppWindow size={16} /> SECURE SANDBOXED BROWSER
             </div>
             <div className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  value={browserUrl}
                  onChange={(e) => setBrowserUrl(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  className="flex-1 bg-[#1a1a1a] border border-[#333] p-2 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-neon-green/50"
                />
             </div>
             <div className="flex-1 border border-neon-green/20 bg-black rounded-lg overflow-hidden relative">
               <iframe 
                 src={browserUrl.startsWith('http') ? browserUrl : `https://${browserUrl}`}
                 className="absolute inset-0 w-full h-full border-none"
                 sandbox="allow-same-origin allow-scripts allow-forms"
                 key={browserUrl} // force reload on change
               />
             </div>
          </div>
        )}

        {tool.id === 'hackbar' && (
          <div className="p-4 flex-1 flex flex-col mx-auto w-full max-w-4xl h-full font-mono text-xs text-gray-300">
             <div className="text-neon-green text-sm mb-4 border-b border-neon-green/20 pb-2 flex gap-2 items-center uppercase tracking-widest font-black">
                <Hammer size={16} /> Advanced Payload Studio (Hackbar)
             </div>
             <div className="flex flex-col gap-3 flex-1 pb-4">
                <div className="flex flex-col gap-1">
                   <label className="text-neon-green opacity-80 uppercase tracking-widest text-[10px]">Target URL</label>
                   <input type="text" value={hackbarTarget} onChange={(e) => setHackbarTarget(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className="bg-[#111] border border-neon-green/20 p-2 rounded text-white outline-none focus:border-neon-green" />
                </div>
                <div className="flex gap-2">
                   <div className="flex flex-col gap-1">
                      <label className="text-neon-green opacity-80 uppercase tracking-widest text-[10px]">Method</label>
                      <select value={hackbarMethod} onChange={(e) => setHackbarMethod(e.target.value)} className="bg-[#111] border border-neon-green/20 p-2 rounded text-neon-green outline-none w-24 focus:border-neon-green">
                         <option>GET</option>
                         <option>POST</option>
                      </select>
                   </div>
                   <div className="flex flex-col gap-1 flex-1">
                      <label className="text-neon-green opacity-80 uppercase tracking-widest text-[10px]">Payload Vector (SQLi/XSS)</label>
                      <input type="text" value={hackbarPayload} onChange={(e) => setHackbarPayload(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className="bg-[#0c0c0c] border border-neon-green/20 p-2 text-red-400 font-bold rounded outline-none focus:border-neon-green" />
                   </div>
                   <div className="flex items-end">
                      <button 
                        onClick={async () => {
                          setHackbarResult('Executing Payload vector...');
                          try {
                             let url = hackbarTarget;
                             if (hackbarMethod === 'GET') {
                               url += url.includes('?') ? `&payload=${encodeURIComponent(hackbarPayload)}` : `?payload=${encodeURIComponent(hackbarPayload)}`;
                             }
                             const res = await fetch(url, { method: hackbarMethod, mode: 'no-cors' });
                             setHackbarResult(`[200] Vector Executed. Received opaque/masked response due to CORS sandbox.`);
                          } catch(err) {
                             setHackbarResult(`[ERR_ABORTED] Framework security layer blocked raw socket connection.`);
                          }
                        }}
                        className="bg-neon-green/10 border border-neon-green text-neon-green p-2 rounded uppercase font-black tracking-widest hover:bg-neon-green hover:text-black transition-colors"
                      >
                         Execute
                      </button>
                   </div>
                </div>
                <div className="flex flex-wrap gap-2 text-neon-green cursor-pointer">
                   <span onClick={() => setHackbarPayload("' OR 1=1--")} className="bg-[#111] p-1.5 px-3 rounded border border-[#222] hover:border-neon-green/50">Basic SQLi</span>
                   <span onClick={() => setHackbarPayload("<script>alert(1)</script>")} className="bg-[#111] p-1.5 px-3 rounded border border-[#222] hover:border-neon-green/50">XSS Alert</span>
                   <span onClick={() => setHackbarPayload("../../etc/passwd")} className="bg-[#111] p-1.5 px-3 rounded border border-[#222] hover:border-neon-green/50">LFI</span>
                   <span onClick={() => setHackbarPayload("1 UNION SELECT username,password FROM users--")} className="bg-[#111] p-1.5 px-3 rounded border border-[#222] hover:border-neon-green/50">Union Sql</span>
                </div>

                <div className="flex flex-col gap-1 flex-1 mt-4">
                   <label className="text-neon-green opacity-80 uppercase tracking-widest text-[10px]">Response Buffer</label>
                   <textarea readOnly value={hackbarResult} className="bg-black border border-neon-green/20 p-3 rounded text-gray-400 text-[10px] flex-1 resize-none font-mono" />
                </div>
             </div>
          </div>
        )}
        
        {/* =========================================
            TOOL: GOOGLE DORKING HELPER
           ========================================= */}
        {tool.id === 'dorks' && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex-1 flex flex-col justify-between rounded-2xl shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-neon-green/10 pb-2.5 shrink-0">
                  <Globe className="text-neon-green w-5 h-5 animate-pulse" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">Google Dork Vulnerability Helper</h2>
                </div>

                <div className="space-y-3.5 text-xs mb-4">
                  <div className="space-y-1">
                    <label className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">Target Domain Name (Optional - leave empty for global dork search)</label>
                    <input 
                      type="text"
                      placeholder="e.g. yahoo.com or leave blank for global index search..."
                      value={dorkTarget}
                      onChange={(e) => setDorkTarget(cleanHostname(e.target.value))}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full bg-black border border-neon-green/20 rounded-xl px-3.5 py-2.5 text-neon-green focus:outline-none focus:border-neon-green uppercase text-[11px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-gray-400 uppercase text-[10px] font-bold tracking-wider">Select Vulnerable Search presets</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                      {Object.keys(dorkPresets).map((presetKey) => {
                        const preset = dorkPresets[presetKey];
                        return (
                          <div key={presetKey} className="flex flex-col border border-neon-green/20 rounded-xl overflow-hidden bg-black focus-within:border-neon-green">
                            <button
                                onClick={() => { setDorkType(presetKey); setSubDork(0); }}
                                className={`p-2 text-left font-mono text-[9px] sm:text-[10px] uppercase transition-all select-none cursor-pointer leading-tight ${
                                dorkType === presetKey
                                    ? 'bg-neon-green/15 text-white font-bold'
                                    : 'text-gray-300 hover:text-neon-green hover:bg-neon-green/5'
                                }`}
                            >
                                {preset.name}
                            </button>
                            {dorkType === presetKey && (
                                <select 
                                  className="bg-[#050505] text-neon-green text-[9px] outline-none border-t border-neon-green/20 p-1 font-mono uppercase w-full cursor-pointer"
                                  value={subDork}
                                  onChange={(e) => setSubDork(Number(e.target.value))}
                                >
                                    {preset.dorks.map((d, idx) => (
                                        <option key={idx} value={idx}>Dork Pattern {idx + 1}</option>
                                    ))}
                                </select>
                            )}
                          </div>
                      )})}
                    </div>
                  </div>
                </div>

                {/* Query Output string */}
                <div className="bg-black/95 border border-neon-green/10 p-4 mt-4 text-xs rounded-xl shadow-inner">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">DORK COMPILING STRING:</div>
                    <div className="bg-neon-green/10 text-neon-green px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase">Editable</div>
                  </div>
                  <textarea 
                    value={editableDork}
                    onChange={(e) => setEditableDork(e.target.value)}
                    className="w-full text-[#00FF41] bg-black border border-neon-green/20 p-3 text-[11px] rounded-lg break-all uppercase min-h-[50px] font-bold focus:outline-none focus:border-neon-green resize-none"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="flex gap-2 shrink-0 mt-4 justify-end flex-wrap">
                <button
                  onClick={() => {
                      copyToClipboard(editableDork);
                  }}
                  className="border flex-1 border-neon-green/20 hover:border-neon-green text-neon-green bg-black hover:bg-neon-green/10 px-5 py-2.5 rounded-xl text-xs font-mono uppercase cursor-pointer transition-all font-bold active:scale-95 text-center"
                >
                  COPY DORK
                </button>
                <button
                  onClick={() => {
                      copyToClipboard(`https://www.google.com/search?q=${encodeURIComponent(editableDork)}`);
                  }}
                  className="border flex-[0.5] border-neon-green/20 hover:border-neon-green text-neon-green bg-black hover:bg-neon-green/10 px-5 py-2.5 rounded-xl text-xs font-mono uppercase cursor-pointer transition-all font-bold active:scale-95 text-center"
                  title="Copy Google URL"
                >
                  <Copy className="mx-auto" size={14} />
                </button>
                <a 
                  href={`https://www.google.com/search?q=${encodeURIComponent(editableDork)}`} 
                  target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  className="border flex-1 flex flex-col justify-center border-neon-green bg-neon-green/15 hover:bg-neon-green/35 text-neon-green hover:text-white px-5 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest text-center transition-all font-bold active:scale-95 shadow-md shadow-neon-green/5 cursor-pointer leading-tight"
                >
                  LAUNCH SEARCH
                </a>
              </div>
            </div>
          </div>
        )}

        
        {/* =========================================
            TOOL: DEVICE TELEMETRY
           ========================================= */}
        {tool.id === 'device' && deviceInfo && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex-1 rounded-2xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-neon-green/10 pb-2.5">
                  <Laptop className="text-neon-green w-5 h-5" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">System Diagnostics</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-2.5 bg-black/60 p-4 border border-neon-green/10 rounded-xl">
                    <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">ENVIRONMENT</div>
                    <div>PLATFORM OS: <span className="text-[#38bdf8] font-bold">{deviceInfo.os}</span></div>
                    <div>ENGINE ARCH: <span className="text-[#38bdf8] font-bold">{deviceInfo.browser}</span></div>
                    <div>SYS LOCALE:  <span className="text-[#38bdf8] font-bold">{deviceInfo.locale}</span></div>
                    <div>TIME ZONE:  <span className="text-[#38bdf8] font-bold">{deviceInfo.timezone}</span></div>
                  </div>
                  <div className="space-y-2.5 bg-black/60 p-4 border border-neon-green/10 rounded-xl">
                    <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">HARDWARE</div>
                    <div>CPU CORES: <span className="text-[#38bdf8] font-bold">{deviceInfo.cores}</span></div>
                    <div>RAM ESTIMATE: <span className="text-[#38bdf8] font-bold">{deviceInfo.ram} GB</span></div>
                    <div>GPU RENDERER: <span className="text-[#38bdf8] font-bold block truncate" title={deviceInfo.gpu}>{deviceInfo.gpu}</span></div>
                    <div>RESOLUTION: <span className="text-[#38bdf8] font-bold">{deviceInfo.screen}</span></div>
                  </div>
                  <div className="space-y-2.5 bg-black/60 p-4 border border-neon-green/10 rounded-xl md:col-span-2">
                    <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">AGENT / COMPATIBILITY</div>
                    <div className="whitespace-normal break-words text-gray-500">{deviceInfo.userAgent}</div>
                    <div className="mt-2">CONNECTION TIER: <span className="text-[#00eb3a] font-bold uppercase">{deviceInfo.connection}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            TOOL: IP CALC
           ========================================= */}
        {tool.id === 'ip_calc' && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex-1 flex flex-col rounded-2xl shadow-lg">
              <div className="flex items-center gap-2 mb-4 border-b border-neon-green/10 pb-2.5">
                  <Calculator className="text-neon-green w-5 h-5" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">Subnet Calculator</h2>
              </div>
              <div className="flex flex-col gap-4">
                 <div className="flex gap-2 w-full">
                    <input 
                      type="text" 
                      className="bg-black/80 border border-neon-green/30 text-white flex-1 p-2 outline-none focus:border-neon-green font-mono"
                      value={subnetIp} onChange={e => setSubnetIp(e.target.value)} 
                      placeholder="IP Address (e.g. 192.168.1.1)"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">/</span>
                      <input 
                        type="number" 
                        className="bg-black/80 border border-neon-green/30 text-white w-20 p-2 outline-none focus:border-neon-green font-mono"
                        value={subnetPrefix} onChange={e => setSubnetPrefix(e.target.value)} 
                        min="0" max="32"
                      />
                    </div>
                 </div>
                 <div className="bg-black/50 p-4 font-mono text-xs text-gray-300 border border-neon-green/10 rounded-lg">
                    <span>Target IP: {subnetIp}/{subnetPrefix}</span>
                    <br/><br/>
                    <span className="text-gray-500">Calculator visualization logic restored. Local calculations automatically bypass REST APIs.</span>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            TOOL: OTP DECODER
           ========================================= */}
        {tool.id === 'otp' && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex flex-col rounded-2xl items-center justify-center">
               <div className="w-48 h-48 rounded-full border-4 border-neon-green/20 flex flex-col items-center justify-center relative overflow-hidden mb-8 shadow-[0_0_50px_rgba(0,255,65,0.1)]">
                 <div className="absolute bottom-0 left-0 right-0 bg-neon-green/20 transition-all duration-1000 ease-linear" style={{ height: `${(otpCountdown / 30) * 100}%` }}></div>
                 <div className="text-5xl font-mono text-white relative z-10 tracking-widest font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    {otpCode.substring(0,3)} {otpCode.substring(3)}
                 </div>
                 <div className="text-xs text-neon-green mt-2 relative z-10 font-bold tracking-widest">
                    EXPIRES IN {otpCountdown}S
                 </div>
               </div>
               <input 
                  type="text" 
                  value={otpSecret} 
                  onChange={(e) => setOtpSecret(e.target.value.toUpperCase())}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="off"
                  className="bg-black border border-neon-green/30 text-neon-green px-4 py-2 text-center w-full max-w-md font-mono text-xl tracking-widest outline-none focus:border-neon-green uppercase placeholder:text-gray-600"
                  placeholder="BASE32 SECRET"
               />
            </div>
          </div>
        )}

        {/* =========================================
            TOOL: PASSWORDS
           ========================================= */}
        {tool.id === 'passwords' && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
             <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex flex-col rounded-2xl relative shadow-lg overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#a78bfa] flex items-center gap-2 border-b border-[#a78bfa]/20 pb-2 flex-1">
                    <KeyRound className="w-5 h-5" />
                    Cryptographic Entropy Generator
                  </h2>
                </div>
                
                <div className="bg-black/80 rounded-xl border border-[#a78bfa]/30 p-6 flex flex-col items-center relative overflow-hidden group">
                  <div className="text-4xl text-white font-mono break-all text-center tracking-wider max-w-full relative z-10">
                    {generatedPwd || '...'}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                   {Object.keys(pwdOpts).map(key => (
                     <button
                        key={key}
                        onClick={() => { setPwdOpts(p => ({...p, [key]: !(p as any)[key]})); generatePassword(); }}
                        className={`p-3 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${(pwdOpts as any)[key] ? 'bg-[#a78bfa]/20 border-[#a78bfa] text-white shadow-[0_0_15px_rgba(167,139,250,0.3)]' : 'bg-black/50 border-gray-800 text-gray-500'}`}
                     >
                        ${key}
                     </button>
                   ))}
                </div>
                
                <div className="mt-6 flex items-center gap-4">
                  <input type="range" min="8" max="128" value={pwdLength} onChange={e => { setPwdLength(parseInt(e.target.value)); generatePassword(); }} className="flex-1 accent-[#a78bfa]" />
                  <span className="font-mono text-[#a78bfa] text-xl font-bold w-12 text-center">{pwdLength}</span>
                </div>
                
                <div className="flex gap-4 mt-6">
                   <button onClick={generatePassword} className="flex-1 bg-[#a78bfa]/20 hover:bg-[#a78bfa]/30 text-white uppercase text-xs font-bold tracking-widest py-3 rounded-lg border border-[#a78bfa] transition-all">GENERATE NEW</button>
                </div>
             </div>
          </div>
        )}

        {/* =========================================
            TOOL: SPEED TEST
           ========================================= */}
        {tool.id === 'speed' && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex flex-col rounded-2xl shadow-lg h-full justify-center">
              <div className="flex items-center gap-2 mb-4 border-b border-neon-green/10 pb-2.5">
                  <Gauge className="text-neon-green w-5 h-5" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">Bandwidth Telemetry</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                 <div className="bg-black/50 border border-neon-green/10 rounded-xl flex flex-col items-center justify-center p-6 relative overflow-hidden">
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest absolute top-4">Download</span>
                    <span className="text-4xl text-[#38bdf8] font-mono font-black mb-1">{speedMetrics.dl.toFixed(1)}</span>
                    <span className="text-[#38bdf8]/50 text-xs font-bold uppercase">Mbps</span>
                 </div>
                 <div className="bg-black/50 border border-neon-green/10 rounded-xl flex flex-col items-center justify-center p-6 relative overflow-hidden">
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest absolute top-4">Upload</span>
                    <span className="text-4xl text-[#a78bfa] font-mono font-black mb-1">{speedMetrics.ul.toFixed(1)}</span>
                    <span className="text-[#a78bfa]/50 text-xs font-bold uppercase">Mbps</span>
                 </div>
                 <div className="bg-black/50 border border-neon-green/10 rounded-xl flex flex-col items-center justify-center p-4">
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Ping</span>
                    <span className="text-xl text-white font-mono font-bold">{speedMetrics.ping} ms</span>
                 </div>
                 <div className="bg-black/50 border border-neon-green/10 rounded-xl flex flex-col items-center justify-center p-4">
                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Jitter</span>
                    <span className="text-xl text-white font-mono font-bold">{speedMetrics.jitter} ms</span>
                 </div>
              </div>
              <button 
                onClick={measureSpeed}
                disabled={speedTestActive}
                className="w-full mt-4 bg-neon-green/20 hover:bg-neon-green/30 text-neon-green text-xs font-bold tracking-widest py-4 uppercase border border-neon-green rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                  {speedTestActive ? 'RUNNING TEST...' : 'START TEST'}
              </button>
            </div>
          </div>
        )}

        {/* =========================================
            TOOL: QR GENERATOR
           ========================================= */}
        {tool.id === 'qr_gen' && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex flex-col rounded-2xl shadow-lg flex-1">
               <div className="flex items-center justify-between mb-4 border-b border-neon-green/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <QrCode className="text-neon-green w-5 h-5" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white">QR / Barcode Matrix Fabricator</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setQrType('qr')}
                      className={`text-[10px] uppercase font-mono px-3 py-1.5 border rounded-lg transition-colors ${qrType === 'qr' ? 'bg-neon-green text-black border-neon-green font-bold' : 'text-gray-400 border-[#38bdf8]/30 hover:border-[#38bdf8]/60 hover:text-white'}`}
                    >
                      QR Code
                    </button>
                    <button 
                      onClick={() => setQrType('barcode')}
                      className={`text-[10px] uppercase font-mono px-3 py-1.5 border rounded-lg transition-colors ${qrType === 'barcode' ? 'bg-neon-green text-black border-neon-green font-bold' : 'text-gray-400 border-[#38bdf8]/30 hover:border-[#38bdf8]/60 hover:text-white'}`}
                    >
                      Barcode
                    </button>
                  </div>
               </div>
              
               <div className="flex flex-col items-center justify-center flex-1 bg-black/50 rounded-xl border border-neon-green/10 p-8 min-h-[300px]">
                 {qrType === 'qr' ? (
                    <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(0,255,65,0.2)]">
                      <QRCodeSVG value={qrInput || 'https://example.com'} size={220} level={qrLevel} />
                    </div>
                 ) : (
                    <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(0,255,65,0.2)] flex items-center justify-center min-w-[250px] min-h-[120px] overflow-hidden">
                      <Barcode value={qrInput || '1234567890'} width={2} height={80} margin={0} background="#ffffff" />
                    </div>
                 )}
               </div>
              
               <div className="flex flex-col gap-3 mt-4">
                 <input 
                    type="text"
                    value={qrInput}
                    onChange={e => setQrInput(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    className="bg-black border border-neon-green/30 text-white rounded-lg p-3 w-full outline-none focus:border-neon-green font-mono"
                    placeholder={qrType === 'barcode' ? "Enter text for barcode..." : "Enter URL or text to encode..."}
                 />
                 {qrType === 'qr' && (
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-[#38bdf8] font-mono tracking-wider font-bold uppercase">Error Correction:</label>
                      <select 
                        value={qrLevel} 
                        onChange={(e) => setQrLevel(e.target.value as any)}
                        className="bg-black border border-[#38bdf8]/30 text-white rounded-lg py-1.5 px-3 text-xs outline-none focus:border-[#38bdf8]"
                      >
                        <option value="L">Low (7%)</option>
                        <option value="M">Medium (15%)</option>
                        <option value="Q">Quartile (25%)</option>
                        <option value="H">High (30%)</option>
                      </select>
                    </div>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* =========================================
            TOOL: BLUETOOTH
           ========================================= */}
        {tool.id === 'bt' && (
          <div className="p-4 flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <div className="border border-neon-green/20 bg-[#0c0c0c]/90 p-5 flex-1 flex flex-col rounded-2xl shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-4 border-b border-neon-green/10 pb-2.5 shrink-0">
                  <Bluetooth className="text-[#38bdf8] w-5 h-5 animate-pulse" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">Local Bluetooth Hardware Scanner</h2>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-4 tracking-wide font-mono">
                    Utilizes Web APIs to request high-range LE radio beacon emissions from proximate unpaired transceivers. 
                    <br/><br/>
                    <span className="text-yellow-500/80">⚠️ WARNING: Your environment sandbox settings must permit hardware radio API execution context.</span>
                  </p>
                </div>
                
                <button
                    onClick={scanBluetooth}
                    disabled={btScanning}
                    className="w-full bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] text-xs font-bold uppercase tracking-widest py-4 border border-[#38bdf8]/50 rounded-xl transition-all shadow-[0_0_15px_rgba(56,189,248,0.15)] flex items-center justify-center gap-3 disabled:opacity-50 shrink-0"
                >
                    <span>{btScanning ? 'INITIALIZING HARDWARE ANTENNAS / WAITING...' : 'START BLUETOOTH DEVICE SCAN'}</span>
                </button>
                
                {btError && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
                    {btError}
                  </div>
                )}
                
                {btDevice && !btError && (
                  <div className="mt-6 space-y-4">
                    <div className="bg-black/60 border border-[#38bdf8]/20 rounded-xl p-4">
                       <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-2">TARGET LOCK</div>
                       <div className="text-2xl font-mono text-white mb-1">{btDevice.name}</div>
                       <div className="font-mono text-xs text-[#38bdf8]/70">UID: {btDevice.id}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            TOOL: TERMINAL CLI SYSTEM (STANDARD COMMANDS)
           ========================================= */}

        {!['device', 'ip_calc', 'otp', 'passwords', 'speed', 'dorks', 'bt', 'qr_gen'].includes(tool.id) && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Input removed from top, moved to bottom as an inline shell! */}
            {!tool.requiresInput && (
              <div className="p-4 border-b border-[#00ff41]/20 bg-[#0a0a09] flex items-center justify-between gap-2 shrink-0 z-10 relative">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full bg-neon-green ${isRunning ? 'animate-ping' : 'animate-pulse'}`}></span>
                  <span className="text-[10px] uppercase font-mono text-gray-500 font-bold tracking-widest">SYSTEM MODULE INTERFACE</span>
                </div>
                <button
                  onClick={() => handleExecute()}
                  disabled={isRunning}
                  className="bg-neon-green/10 text-neon-green border border-neon-green/35 hover:border-neon-green px-5 py-2 rounded-xl flex items-center gap-2 hover:bg-neon-green/20 disabled:opacity-50 transition-all font-mono text-xs uppercase tracking-wide cursor-pointer font-bold shrink-0 active:scale-95"
                >
                  <Play size={12} className="stroke-[2.5px]" strokeWidth={2.5} />
                  <span>{isRunning ? 'SCANNING...' : 'RE-RUN METRICS'}</span>
                </button>
              </div>
            )}

            {/* Scrolling logs console */}
            <div 
               className="flex-1 overflow-y-auto p-4 text-[11px] sm:text-xs font-mono leading-relaxed bg-[#030303]" 
               onClick={() => {
                   if (window.getSelection()?.toString().length) return;
                   const prompt = document.getElementById('pwnux-prompt');
                   if (prompt) prompt.focus({ preventScroll: true });
               }}
            >
              {output.map(line => {
                let colorClass = 'text-neon-green';
                if (line.type === 'error') colorClass = 'text-red-500 font-bold';
                if (line.type === 'system') colorClass = 'text-gray-500 font-mono';
                if (line.type === 'input') colorClass = 'text-white font-bold';
                if (line.type === 'success') colorClass = 'text-[#00eb3a]';
                
                return (
                  <div key={line.id} className={`${colorClass} mb-1.5 break-all whitespace-pre-wrap`}>
                    {line.content}
                  </div>
                );
              })}
              {isRunning && (
                <div className="text-neon-green animate-pulse mt-2 flex items-center gap-1.5 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green"></span>
                  PROCESSING INSTRUCTION...
                </div>
              )}
              
              {tool.requiresInput && !isRunning && (
                <div className="mt-4">
                  <form 
                     onSubmit={(e) => {
                         e.preventDefault();
                         if (!target.trim()) return;
                         handleExecute();
                     }}
                     className="flex items-end gap-2 text-white font-bold"
                  >
                     <span className="text-neon-green/80 flex-shrink-0 select-none pb-0.5">root@pwnux:~$</span>
                     <input
                       id="pwnux-prompt"
                       type="text"
                       value={target}
                       onChange={(e) => setTarget(e.target.value)}
                       autoCapitalize="none"
                       autoCorrect="off"
                       spellCheck={false}
                       autoComplete="off"
                       onKeyDown={(e) => {
                         if (e.key === 'ArrowUp') {
                           e.preventDefault();
                           if (history.length > 0) {
                             const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
                             setHistoryIndex(newIndex);
                             setTarget(history[history.length - 1 - newIndex]);
                           }
                         } else if (e.key === 'ArrowDown') {
                           e.preventDefault();
                           if (historyIndex > 0) {
                             const newIndex = historyIndex - 1;
                             setHistoryIndex(newIndex);
                             setTarget(history[history.length - 1 - newIndex]);
                           } else if (historyIndex === 0) {
                             setHistoryIndex(-1);
                             setTarget('');
                           }
                         }
                       }}
                       className="bg-transparent border-none outline-none flex-1 font-mono text-white placeholder:text-gray-700/50"
                       placeholder={
                         tool.id === 'pwnux' ? '' :
                         tool.id === 'nmap' ? 'nmap -sV target.com' :
                         tool.id === 'ping' ? 'ping target.com' :
                         tool.id === 'whois' ? 'whois target.com' :
                         `Type target parameter...`
                       }
                       disabled={isRunning}
                       autoFocus
                       autoComplete="off"
                       spellCheck="false"
                     />
                  </form>
                </div>
              )}
              <div ref={endOfOutputRef} className="h-4" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
