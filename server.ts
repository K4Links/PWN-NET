import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';
import cors from 'cors';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Helper for port scanning
const checkPort = (port: number, host: string, timeout = 2000): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.on('connect', () => {
      status = true;
      socket.destroy();
    });

    socket.setTimeout(timeout);
    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('error', () => {
      socket.destroy();
    });

    socket.on('close', () => {
      resolve(status);
    });

    socket.connect(port, host);
  });
};

// --- API ROUTES ---

// 1. Port Scanner
app.get('/api/net/portscan', async (req, res) => {
  const { target, ports } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  const defaultPorts = [
    { port: 21, service: 'FTP' },
    { port: 22, service: 'SSH' },
    { port: 23, service: 'Telnet' },
    { port: 25, service: 'SMTP' },
    { port: 53, service: 'DNS' },
    { port: 80, service: 'HTTP' },
    { port: 110, service: 'POP3' },
    { port: 143, service: 'IMAP' },
    { port: 443, service: 'HTTPS' },
    { port: 445, service: 'SMB' },
    { port: 3306, service: 'MySQL' },
    { port: 8080, service: 'HTTP-Proxy' }
  ];

  let portsToScan = defaultPorts;
  if (ports && typeof ports === 'string') {
    portsToScan = ports.split(',').map(p => ({ port: parseInt(p, 10), service: 'Unknown' })).filter(p => !isNaN(p.port));
  }

  try {
    const results = await Promise.all(
      portsToScan.map(async (p) => {
        const isOpen = await checkPort(p.port, target, 2500);
        return { ...p, isOpen };
      })
    );
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to scan ports' });
  }
});

// 1.1 Blacklist
app.get('/api/net/blacklist', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }
  try {
    const isIp = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(target);
    let ip = target;
    if (!isIp) {
      const lookRes = await dns.promises.lookup(target);
      ip = lookRes.address;
    }
    const reverseIp = ip.split('.').reverse().join('.');
    
    const lists = ['zen.spamhaus.org', 'b.barracudacentral.org', 'bl.spamcop.net'];
    const results = await Promise.all(lists.map(async (list) => {
      try {
        await dns.promises.resolve(`${reverseIp}.${list}`);
        return { list, clean: false };
      } catch (e) {
        return { list, clean: true };
      }
    }));
    res.json({ ip, results });
  } catch (e) {
    res.status(500).json({ error: 'DNS resolution failed' });
  }
});

// 1.2 Shodan Proxy (Host Search)
app.get('/api/net/shodan', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }
  try {
    const data = await fetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(target)}`);
    const text = await data.text();
    res.json({ result: text });
  } catch (e) {
    res.status(500).json({ error: 'Failed HT lookup' });
  }
});

// 1.3 VirusTotal Proxy (Reverse IP/DNS)
app.get('/api/net/vt', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }
  try {
    const isIp = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(target);
    const api = isIp ? 'reverseiplookup' : 'dnslookup';
    const data = await fetch(`https://api.hackertarget.com/${api}/?q=${encodeURIComponent(target)}`);
    const text = await data.text();
    res.json({ result: text });
  } catch (e) {
    res.status(500).json({ error: 'Failed HT lookup' });
  }
});

// 1.4 Spider Proxy (Page Links)
app.get('/api/net/spider', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }
  try {
    const data = await fetch(`https://api.hackertarget.com/pagelinks/?q=${encodeURIComponent(target)}`);
    const text = await data.text();
    res.json({ result: text });
  } catch (e) {
    res.status(500).json({ error: 'Failed HT lookup' });
  }
});


// 1.5 HTTP Headers
app.get('/api/net/http', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }
  try {
    const data = await fetch(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent(target)}`);
    const text = await data.text();
    res.json({ result: text });
  } catch (e) {
    res.status(500).json({ error: 'Failed HT lookup' });
  }
});

// 2. Mail Servers (MX & TXT)
app.get('/api/net/mail', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  try {
    let mxRecords = [];
    try {
      mxRecords = await resolveMx(target);
      // Sort by priority
      mxRecords.sort((a, b) => a.priority - b.priority);
    } catch (e) {
      // Ignored if no MX
    }

    let txtRecordsStr = [];
    try {
      const txtRecords = await resolveTxt(target);
      txtRecordsStr = txtRecords.map(t => t.join(''));
    } catch (e) {
      // Ignored if no TXT
    }

    // Filter TXT for SPF and DMARC
    const spf = txtRecordsStr.filter(r => r.startsWith('v=spf1'));
    
    // Attempt DMARC lookup if target is domain
    let dmarc = [];
    try {
      const dmarcTxt = await resolveTxt(`_dmarc.${target}`);
      dmarc = dmarcTxt.map(t => t.join('')).filter(r => r.startsWith('v=DMARC1'));
    } catch (e) {
      // Ignored
    }

    res.json({ mx: mxRecords, spf, dmarc });
  } catch (error) {
    res.status(500).json({ error: 'Failed DNS lookup' });
  }
});

// 3. MAC Vendor Lookup
app.get('/api/net/mac', async (req, res) => {
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'MAC Address is required' });
  }

  try {
    // MacVendors API is free and doesn't require keys for simple GETs
    const response = await fetch(`https://api.macvendors.com/${encodeURIComponent(address)}`);
    if (response.ok) {
      const vendor = await response.text();
      res.json({ vendor });
    } else {
      res.status(404).json({ error: 'Vendor not found for this MAC address' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to lookup MAC' });
  }
});

// 4. Traceroute (using HackerTarget API)
app.get('/api/net/traceroute', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  try {
    const response = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(target)}`);
    if (response.ok) {
      const data = await response.text();
      // the api sometimes returns limit messages
      if (data.includes('error') || data.includes('API count exceeded')) {
        res.status(429).json({ error: 'API limit exceeded. Please try again later.' });
      } else {
        res.json({ result: data });
      }
    } else {
      res.status(500).json({ error: 'Failed to perform traceroute' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to perform traceroute' });
  }
});

// 5. Network Scanner (Lightweight Ping / Socket sweep of targeted CIDR base)
app.get('/api/net/netscan', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  try {
    // Basic IP detection
    let scanIp = target;
    if (!/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(target)) {
       try {
         const dnsRes = await resolveTxt(target); // just to check if it resolves, fallback to lookup
       } catch(e) {}
       // Node defaults to callback dns.lookup, let's use dns.promises
       const lookRes = await dns.promises.lookup(target);
       scanIp = lookRes.address;
    }

    const parts = scanIp.split('.');
    if (parts.length === 4) {
      const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
      const targetsToScan = [1, 2, 10, 20, 50, 100, Number(parts[3]), 254];
      // remove dups
      const uniqueTargets = [...new Set(targetsToScan)].slice(0, 5);

      const results = await Promise.all(
        uniqueTargets.map(async (lastOctet) => {
          const ip = `${base}.${lastOctet}`;
          const isAlive = await checkPort(80, ip, 1000) || await checkPort(443, ip, 1000);
          return { ip, isAlive };
        })
      );
      res.json({ targetIp: scanIp, alive: results.filter(r => r.isAlive) });
    } else {
      res.status(400).json({ error: 'Invalid IPv4 structure' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to scan subnet for target' });
  }
});

// 6. Shell/FTP connect banner grab
app.get('/api/net/shell', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  const grabBanner = (port: number, host: string, timeout = 3000): Promise<{open: boolean, banner: string, error?: string}> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let buf = '';
      let tcpError = '';

      socket.setTimeout(timeout);

      socket.on('data', (data) => {
        buf += data.toString();
        if (buf.length > 5) {
           socket.destroy();
        }
      });

      socket.on('connect', () => {
      });

      socket.on('timeout', () => {
        tcpError = 'ETIMEDOUT (Connection timed out)';
        socket.destroy();
      });

      socket.on('error', (err: any) => {
        tcpError = err.code || err.message || 'Connection failed';
        socket.destroy();
      });

      socket.on('close', () => {
        resolve({ 
          open: buf.length > 0 || socket.bytesRead > 0, 
          banner: buf.trim(),
          error: tcpError
        });
      });

      try {
        socket.connect(port, host);
      } catch (err: any) {
        resolve({ open: false, banner: '', error: err.message });
      }
    });
  };

  try {
    const [ssh, ftp] = await Promise.all([
      grabBanner(22, target),
      grabBanner(21, target)
    ]);
    res.json({ ssh, ftp });
  } catch (error) {
    res.status(500).json({ error: 'Banner grab failed' });
  }
});

// 7. GeoIP / IP Info (Using IP-API)
app.get('/api/net/geoip', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  try {
    let lookupTarget = target;
    // Resolve DNS First if it's a domain
    if (!/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(target)) {
      try {
        const lookRes = await dns.promises.lookup(target);
        lookupTarget = lookRes.address;
      } catch (err) {
         return res.status(404).json({ error: 'DNS resolution failed for target host' });
      }
    }

    const geoResponse = await fetch(`http://ip-api.com/json/${lookupTarget}`);
    if (geoResponse.ok) {
      const geoResult = await geoResponse.json();
      if (geoResult.status === 'success') {
         res.json({ targetIp: lookupTarget, geo: geoResult });
         return;
      }
    }
    
    res.status(404).json({ error: 'Geolocation data not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve IP/Host info' });
  }
});

// 8. TCP Ping
app.get('/api/net/ping', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  let hostIp = target;
  try {
    const lookRes = await dns.promises.lookup(target);
    hostIp = lookRes.address;
  } catch (e) {
    return res.status(404).json({ error: 'DNS resolution failed.' });
  }

  const pingTcp = (port: number): Promise<number | null> => {
     return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        let connected = false;
        
        socket.setTimeout(2000);
        socket.on('connect', () => {
           connected = true;
           socket.destroy();
           resolve(Date.now() - start);
        });
        socket.on('timeout', () => {
           socket.destroy();
           resolve(null);
        });
        socket.on('error', () => {
           socket.destroy();
           if (!connected) resolve(null);
        });
        socket.connect(port, hostIp);
     });
  };

  try {
    const time80 = await pingTcp(80);
    const time443 = await pingTcp(443);
    
    if (time80 !== null) {
       res.json({ ip: hostIp, port: 80, time: time80 });
    } else if (time443 !== null) {
       res.json({ ip: hostIp, port: 443, time: time443 });
    } else {
       res.status(408).json({ error: 'Host unreachable or blocked ICMP/TCP ping requests' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Ping failed' });
  }
});

// 9. TLS Certificate Verification
app.get('/api/net/certs', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  const tls = require('tls');
  
  const options = {
    host: target,
    port: 443,
    servername: target,
    rejectUnauthorized: false
  };

  const socket = tls.connect(options, () => {
    const cert = socket.getPeerCertificate(true);
    socket.destroy();

    if (cert && Object.keys(cert).length > 0) {
      res.json({
        subject: cert.subject,
        issuer: cert.issuer,
        valid_from: cert.valid_from,
        valid_to: cert.valid_to,
        fingerprint: cert.fingerprint,
        fingerprint256: cert.fingerprint256,
        serialNumber: cert.serialNumber
      });
    } else {
      res.status(404).json({ error: 'No certificate retrieved' });
    }
  });

  socket.setTimeout(3000);
  socket.on('timeout', () => {
    socket.destroy();
    res.status(408).json({ error: 'Timeout waiting for TLS socket' });
  });

  socket.on('error', (err: any) => {
    socket.destroy();
    res.status(500).json({ error: err.message || 'TLS connection failed' });
  });
});

// 10. Have I Been Pwned check (using unofficial free lookup or error if blocked)
app.get('/api/net/pwned', async (req, res) => {
  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  // Note: HIBP requires an API key, we will attempt to query a public endpoint or inform the user it requires an API key. 
  // Let's use the standard haveibeenpwned.com API, but it returns 401 without a key.
  // Instead of faking, we make the request and if it errors, we return the real error.
  
  try {
     const pwnedRes = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`);
     if (pwnedRes.ok) {
        const data = await pwnedRes.json();
        res.json({ breaches: data });
     } else if (pwnedRes.status === 404) {
        res.json({ breaches: [] }); // Not pawned
     } else if (pwnedRes.status === 401) {
        res.status(401).json({ error: 'This tool requires a Have I Been Pwned API Key to be configured on the server environment. Provide API key in .env to use.' });
     } else {
        res.status(500).json({ error: `HIBP API returned status ${pwnedRes.status}`});
     }
  } catch (error) {
     res.status(500).json({ error: 'Failed to contact HIBP registry' });
  }
});

// 11. Directory Scanner
app.get('/api/net/dirscan', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  const commonDirs = [
    'admin', 'login', 'dashboard', 'api', 'assets', 'css', 'js', 'images',
    'wp-admin', 'wp-content', 'robots.txt', 'sitemap.xml', '.git', '.git/config',
    '.env', 'backup', 'old', 'test', 'dev', 'logs', 'config'
  ];

  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
     baseUrl = 'http://' + baseUrl;
  }

  try {
     const results = [];
     for (const dir of commonDirs) {
       try {
         const url = `${baseUrl}/${dir}`;
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), 2000);
         
         const response = await fetch(url, { 
             method: 'HEAD', 
             redirect: 'manual',
             signal: controller.signal
         });
         clearTimeout(timeoutId);
         
         const status = response.status;
         // Sometimes 403 or 301 is a hit for directories
         if (status !== 404 && status !== 0) {
            results.push({ path: `/${dir}`, status });
         }
       } catch (err) {
         // Network error or timeout, ignore and continue
       }
     }
     res.json({ results });
  } catch (error) {
     res.status(500).json({ error: 'Directory scan failed' });
  }
});

// 12. Admin Finder
app.get('/api/net/adminfinder', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target is required' });
  const dirs = ['admin', 'login', 'admin/login.php', 'administrator', 'wp-admin', 'cpanel', 'config', 'dashboard'];
  
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  const results = [];
  try {
     for (const dir of dirs) {
       try {
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), 2000);
         const resNode = await fetch(`${baseUrl}/${dir}`, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
         clearTimeout(timeoutId);
         if (resNode.status !== 404 && resNode.status !== 0) {
            results.push({ path: `/${dir}`, status: resNode.status });
         }
       } catch (err) {}
     }
     res.json({ results });
  } catch(e) {
     res.status(500).json({ error: 'Scan failed' });
  }
});

// 13. React/Next Scanner
app.get('/api/net/reactscan', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target is required' });
  const dirs = ['_next/static/development', '_next/data', 'api/health', 'robots.txt'];
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  const results = [];
  try {
     for (const dir of dirs) {
       try {
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), 2000);
         const resNode = await fetch(`${baseUrl}/${dir}`, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
         clearTimeout(timeoutId);
         if (resNode.status !== 404 && resNode.status !== 0) {
            results.push({ path: `/${dir}`, status: resNode.status });
         }
       } catch (err) {}
     }
     res.json({ results });
  } catch(e) {
     res.status(500).json({ error: 'Scan failed' });
  }
});

// 14. Phone Crawler
app.get('/api/net/phonecrawl', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target is required' });
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  try {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 5000);
     const response = await fetch(baseUrl, { signal: controller.signal });
     clearTimeout(timeoutId);
     const text = await response.text();
     const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
     const matches = text.match(phoneRegex) || [];
     const uniqueMatches = [...new Set(matches.map(m => m.trim()))].filter(m => m.length >= 10);
     res.json({ count: uniqueMatches.length, numbers: uniqueMatches });
  } catch(e) {
     res.status(500).json({ error: 'Crawler failed to fetch target' });
  }
});

// 15. DoS (Stress test limited to small burst for safety)
app.get('/api/net/dos', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target is required' });
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  // We limit the DOS to max 100 requests to avoid real abuse
  try {
    const promises = Array.from({length: 100}).map((_, i) => {
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 3000);
       return fetch(`${baseUrl}?st=${Date.now()}${i}`, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
              .catch(e => null) // Suppress errors
              .finally(() => clearTimeout(timeoutId));
    });
    // Don't wait for all of them to finish completely or it could take a while
    // Just fire and forget some, wait for some
    await Promise.all(promises.slice(0, 20));
    res.json({ message: 'Stress test burst completed (100 packets)' });
  } catch(e) {
    res.status(500).json({ error: 'Failed to complete stress burst' });
  }
});

// 16. Web Faker
app.get('/api/net/webfaker', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target is required' });
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  try {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 5000);
     const response = await fetch(baseUrl, { signal: controller.signal });
     clearTimeout(timeoutId);
     const html = await response.text();
     res.json({ content: html.substring(0, 1500) + '\\n\\n...[SOURCE TRUNCATED FOR DISPLAY]...' });
  } catch(e) {
     res.status(500).json({ error: 'Failed to fetch source' });
  }
});

// 17. Hackbar
app.all('/api/net/hackbar', async (req, res) => {
  const target = req.query.target as string;
  const method = (req.query.method as string || 'GET').toUpperCase();
  const payload = req.query.payload as string;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target is required' });
  
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http')) baseUrl = 'http://' + baseUrl;
  
  if (method === 'GET' && payload) {
    baseUrl += baseUrl.includes('?') ? `&payload=${encodeURIComponent(payload)}` : `?payload=${encodeURIComponent(payload)}`;
  }
  
  try {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 10000);
     
     const fetchOptions: RequestInit = {
       method,
       signal: controller.signal
     };
     
     if (method === 'POST' && payload) {
       fetchOptions.body = new URLSearchParams({ payload });
       fetchOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
     }
     
     const response = await fetch(baseUrl, fetchOptions);
     clearTimeout(timeoutId);
     const html = await response.text();
     
     res.json({
       status: response.status,
       statusText: response.statusText,
       data: html.substring(0, 5000)
     });
  } catch(e: any) {
     res.status(500).json({ error: e.message || 'Failed to fetch source' });
  }
});

// Speedtest Backend
app.get('/api/net/speedtest/download', (req, res) => {
  const size = parseInt(req.query.size as string) || 1024 * 1024 * 5; // default 5MB
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Length', size.toString());
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  const chunk = Buffer.alloc(1024 * 64, '0'); // 64KB chunks
  let sent = 0;
  
  const sendData = () => {
    while (sent < size) {
      let toSend = Math.min(chunk.length, size - sent);
      sent += toSend;
      if (!res.write(chunk.slice(0, toSend))) {
        res.once('drain', sendData);
        return;
      }
    }
    res.end();
  };
  
  sendData();
});

app.post('/api/net/speedtest/upload', (req, res) => {
  let received = 0;
  req.on('data', chunk => {
    received += chunk.length;
  });
  req.on('end', () => {
    res.json({ success: true, bytesReceived: received });
  });
});

// 18. WP Scanner
app.get('/api/net/wpscan', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target is required' });
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  try {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 5000);
     const response = await fetch(baseUrl, { signal: controller.signal });
     clearTimeout(timeoutId);
     const text = await response.text();
     const isWp = text.toLowerCase().includes('wp-content') || text.toLowerCase().includes('wp-includes');
     res.json({ isWordPress: isWp, headers: Object.fromEntries(response.headers.entries()) });
  } catch(e) {
     res.status(500).json({ error: 'WP scan fetch failed' });
  }
});

// --- VITE DEV SERVER OR PROD STATIC ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
