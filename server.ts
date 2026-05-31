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

// 1.2 DNS Endpoint Natively
app.get('/api/net/dns', async (req, res) => {
  const { target, server, reverse } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target required' });
  
  try {
    const resolver = new dns.promises.Resolver();
    if (server && typeof server === 'string' && server !== 'default') {
      try { resolver.setServers([server]); } catch (e) {
          // fallback
      }
    }

    let output = '';
    output += `; <<>> PWN//NET DNS Lookup <<>> ${target}\n`;
    if (server && server !== 'default') output += `; Server: ${server}\n`;
    output += `\n`;

    if (reverse === 'true') {
       try {
          const hostnames = await resolver.reverse(target);
          output += ';; REVERSE RECORDS:\n' + hostnames.map(r => `${target}.\tIN\tPTR\t${r}`).join('\n') + '\n\n';
       } catch (e: any) {
          output += `;; REVERSE LOOKUP FAILED: ${e.message}\n`;
       }
       return res.json({ result: output || 'No Reverse DNS records found.' });
    }

    try {
       const ns = await resolver.resolveNs(target);
       output += ';; NS RECORDS:\n' + ns.map(r => `${target}.\tIN\tNS\t${r}`).join('\n') + '\n\n';
    } catch(e) {}
    try {
       const a = await resolver.resolve4(target);
       output += ';; A RECORDS:\n' + a.map(r => `${target}.\tIN\tA\t${r}`).join('\n') + '\n\n';
    } catch(e) {}
    try {
       const mx = await resolver.resolveMx(target);
       output += ';; MX RECORDS:\n' + mx.map(r => `${target}.\tIN\tMX\t${r.priority} ${r.exchange}`).join('\n') + '\n\n';
    } catch(e) {}
    try {
       const txt = await resolver.resolveTxt(target);
       output += ';; TXT RECORDS:\n' + txt.map(r => `${target}.\tIN\tTXT\t"${r.join('')}"`).join('\n') + '\n';
    } catch(e) {}
    res.json({ result: output || 'No DNS records found.' });
  } catch (e) {
    res.json({ result: 'No DNS records found or lookup failed.' });
  }
});

// 1.3 Whois Endpoint Natively
app.get('/api/net/whois', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Target required' });
  try {
    const socket = new net.Socket();
    let data = '';
    socket.setTimeout(5000);
    socket.connect(43, 'whois.iana.org', () => {
      socket.write(target + '\r\n');
    });
    socket.on('data', chunk => data += chunk);
    socket.on('end', () => res.json({ result: data }));
    socket.on('error', () => res.json({ result: 'Whois lookup failed (connection error).' }));
    socket.on('timeout', () => { socket.destroy(); res.json({ result: 'Whois lookup timed out.' }); });
  } catch(e) {
    res.json({ result: 'Failed to perform whois' });
  }
});

// 1.4 Spider Proxy Natively
app.get('/api/net/spider', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Bad status');
    const text = await response.text();
    
    // Extract unique links
    const matches = text.match(/href=["'](http[^"']+)["']/g) || [];
    const links = [...new Set(matches.map(l => l.replace(/href=["']/i, '').replace(/["'].*$/, '')))];
    
    let result = `Page Links for ${baseUrl}:\n`;
    result += links.slice(0, 30).join('\n');
    if (links.length > 30) result += `\n...and ${links.length - 30} more.`;
    if (links.length === 0) result += 'No external/absolute links found.';
    
    res.json({ result });
  } catch (e) {
    res.json({ result: 'Failed to crawl target. Target may be blocking requests or offline.' });
  }
});

// 1.5 HTTP Headers Natively
app.get('/api/net/http', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'http://' + baseUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(baseUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    
    let result = `HTTP/${response.status === 200 ? '1.1' : '1.1'} ${response.status} ${response.statusText}\n`;
    for (const [key, value] of response.headers.entries()) {
       result += `${key.replace(/(^\w|-\w)/g, c => c.toUpperCase())}: ${value}\n`;
    }
    res.json({ result });
  } catch (e) {
    res.json({ result: 'Failed to fetch HTTP headers. Target may be offline.' });
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

  let hostTarget = target;
  if (target.startsWith('http')) hostTarget = target.replace(/^https?:\/\//, '').split('/')[0];

  try {
    const response = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(hostTarget)}`);
    if (response.ok) {
      const data = await response.text();
      if (data.includes('error') || data.includes('API count exceeded')) {
        // Fallback to fetch test
        const start = Date.now();
        try {
           const rc = new AbortController();
           const rt = setTimeout(() => rc.abort(), 4000);
           await fetch(`http://${hostTarget}`, { signal: rc.signal }).catch(() => fetch(`https://${hostTarget}`, { signal: rc.signal }));
           clearTimeout(rt);
           const time = Date.now() - start;
           res.json({ result: `MTR API limit hit. Fallback HTTP/HTTPS test:\n\nConnected to ${hostTarget}\nTime: ${time}ms\nStatus: REACHABLE\n\n(Full MTR trace disabled in restricted environment)` });
        } catch(e) {
           res.json({ result: `MTR API limit hit. Fallback HTTP/HTTPS test:\n\nCould not reach ${hostTarget} on web ports.\nStatus: UNREACHABLE or FILTERED` });
        }
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

// SMB Audit
app.get('/api/net/smb', async (req, res) => {
  const { target } = req.query;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Target is required' });
  }

  const checkSmb = (): Promise<string> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2500);
      let resolved = false;

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve('open');
        }
      });
      socket.on('error', () => {
        if (!resolved) { resolved = true; resolve('closed'); }
      });
      socket.on('timeout', () => {
        socket.destroy();
        if (!resolved) { resolved = true; resolve('closed'); }
      });
      
      let hostIp = target;
      if (target.startsWith('http')) hostIp = target.replace(/^https?:\/\//, '').split('/')[0];
      
      socket.connect(445, hostIp);
    });
  };

  try {
    const result = await checkSmb();
    res.json({ result });
  } catch(e) {
    res.json({ result: 'error' });
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
  let baseUrl = target.replace(/\/$/, "");
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'https://' + baseUrl;

  const results = [];
  try {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 6000);
     const resNode = await fetch(baseUrl, { method: 'GET', signal: controller.signal, headers: {'User-Agent': 'Mozilla/5.0'} });
     clearTimeout(timeoutId);
     
     if (resNode.ok) {
       const html = await resNode.text();
       
       if (html.includes('__NEXT_DATA__') || html.includes('_next/static')) {
          results.push({ path: 'Next.js Framework Signature', status: 'Detected' });
       }
       if (html.includes('data-reactroot') || html.includes('id="__next"') || html.includes('id="root"')) {
          results.push({ path: 'React DOM Node (Root)', status: 'Detected' });
       }
       if (html.includes('window.React') || html.includes('.createElement(')) {
          results.push({ path: 'React Global Variable/Signatures', status: 'Detected' });
       }
       if (html.includes('static/js/main.') && html.includes('.chunk.js')) {
          results.push({ path: 'Create React App Structure', status: 'Detected' });
       }
       if (html.includes('content="Astro') || html.includes('astro-island')) {
          results.push({ path: 'Astro Framework', status: 'Detected' });
       }
       if (html.includes('gatsby-') || html.includes('id="___gatsby"')) {
          results.push({ path: 'Gatsby Framework', status: 'Detected' });
       }
       if (html.includes('/.remix/') || html.includes('window.__remixContext')) {
          results.push({ path: 'Remix Framework', status: 'Detected' });
       }
       if (html.match(/@vite\/client|vite-plugin-/)) {
          results.push({ path: 'Vite Bundler', status: 'Detected' });
       }
       
       if (results.length === 0) {
          results.push({ path: 'No typical modern React/Next signatures found strictly in HTML root.', status: 'Undetected' });
       }
     } else {
       results.push({ path: `Error: Received HTTP ${resNode.status}`, status: 'Failed' });
     }
     res.json({ results });
  } catch(e) {
     res.status(500).json({ error: 'Scan failed to fetch target URL' });
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
  try {
     const idString = req.query.id as string;
     const seed = idString ? parseInt(idString) || 1 : Math.floor(Math.random() * 10000) + 1;
     
     // Simple seeded random function
     const random = (s: number) => {
         let x = Math.sin(s++) * 10000;
         return x - Math.floor(x);
     };
     
     const firstNames = ['John', 'Jane', 'Alex', 'Chris', 'Katie', 'Mike', 'Sarah', 'Emma', 'David', 'James', 'Mary', 'Robert', 'Patricia', 'Michael', 'Linda', 'William', 'Elizabeth', 'Richard', 'Barbara', 'Joseph', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna', 'Kenneth', 'Michelle', 'Kevin', 'Dorothy', 'Brian', 'Carol', 'George', 'Amanda', 'Edward', 'Melissa', 'Ronald', 'Deborah', 'Timothy', 'Stephanie', 'Jason', 'Rebecca', 'Jeffrey', 'Sharon', 'Ryan', 'Laura', 'Jacob', 'Cynthia', 'Gary', 'Kathleen', 'Nicholas', 'Amy', 'Eric', 'Shirley', 'Jonathan', 'Angela', 'Stephen', 'Helen', 'Larry', 'Anna', 'Justin', 'Brenda', 'Scott', 'Pamela', 'Brandon', 'Nicole', 'Benjamin', 'Emma', 'Samuel', 'Samantha', 'Gregory', 'Katherine', 'Frank', 'Christine', 'Alexander', 'Debra', 'Raymond', 'Rachel', 'Patrick', 'Catherine', 'Jack', 'Carolyn', 'Dennis', 'Janet', 'Jerry', 'Ruth', 'Tyler', 'Maria', 'Aaron', 'Heather', 'Jose', 'Diane', 'Adam', 'Virginia', 'Henry', 'Julie', 'Nathan', 'Joyce', 'Douglas', 'Victoria', 'Zachary', 'Olivia', 'Peter', 'Kelly', 'Kyle', 'Christina', 'Walter', 'Lauren', 'Ethan', 'Joan', 'Jeremy', 'Evelyn', 'Christian', 'Judith', 'Keith', 'Megan', 'Roger', 'Cheryl', 'Terry', 'Andrea', 'Gerald', 'Hannah', 'Harold', 'Martha', 'Sean', 'Jacqueline', 'Austin', 'Frances', 'Carl', 'Gloria', 'Arthur', 'Ann', 'Lawrence', 'Teresa', 'Dylan', 'Kathryn', 'Jesse', 'Sara', 'Jordan', 'Janice', 'Bryan', 'Jean', 'Ralph', 'Alice', 'Joe', 'Madison', 'Noah', 'Doris', 'Bruce', 'Abigail', 'Billy', 'Julia', 'Albert', 'Judy', 'Willie', 'Grace', 'Gabriel', 'Denise', 'Logan', 'Amber', 'Alan', 'Marilyn', 'Juan', 'Beverly', 'Wayne', 'Danielle', 'Roy', 'Theresa', 'Ralph', 'Sophia', 'Randy', 'Marie', 'Eugene', 'Diana', 'Vincent', 'Brittany', 'Russell', 'Natalie', 'Elijah', 'Isabella', 'Louis', 'Charlotte', 'Bobby', 'Rose', 'Philip', 'Alexis', 'Johnny', 'Kayla'];
     const lastNames = ['Smith', 'Doe', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell', 'Sullivan', 'Bell', 'Coleman', 'Washington', 'Butler', 'Barnes'];
     const domains = ['gmail.com', 'yahoo.com', 'protonmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'mail.com', 'zoho.com', 'yandex.com'];
     
     const streetNames = ['Main St', 'Oak St', 'Pine St', 'Maple Ave', 'Cedar Ln', 'Elm St', 'Washington Blvd', 'Park Ave', 'Lakeview Dr', 'Hillcrest Rd', 'Sunset Blvd', 'Lincoln Ave'];
     const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'San Francisco', 'Charlotte', 'Indianapolis', 'Seattle', 'Denver', 'Washington'];
     const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA', 'TX', 'FL', 'TX', 'OH', 'CA', 'NC', 'IN', 'WA', 'CO', 'DC'];
     
     const r = (arr: any[], s: number) => arr[Math.floor(random(s) * arr.length)];
     
     const first = r(firstNames, seed * 1);
     const last = r(lastNames, seed * 2);
     const domain = r(domains, seed * 3);
     const age = Math.floor(random(seed * 4) * 40) + 18;
     
     // Generate birthdate based on age
     const currentYear = new Date().getFullYear();
     const birthYear = currentYear - age;
     const birthMonth = Math.floor(random(seed * 5) * 12) + 1; // 1 to 12
     // Basic day estimation, assuming 28 days for safety
     const birthDay = Math.floor(random(seed * 6) * 28) + 1; 
     const birthdate = `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`;
     
     // Generate address
     const streetNum = Math.floor(random(seed * 7) * 9000) + 100;
     const street = r(streetNames, seed * 8);
     const cityIndex = Math.floor(random(seed * 9) * cities.length);
     const city = cities[cityIndex];
     const state = states[cityIndex]; // Matches state to city roughly
     const zip = Math.floor(random(seed * 10) * 89999) + 10000;
     const address = `${streetNum} ${street}, ${city}, ${state} ${zip}`;
     
     let output = `--- Profile ID: ${seed} ---\n`;
     output += `Name: ${first} ${last}\n`;
     output += `Age: ${age}\n`;
     output += `Birthdate: ${birthdate}\n`;
     output += `Address: ${address}\n`;
     output += `Email: ${first.toLowerCase()}.${last.toLowerCase()}${age}@${domain}\n`;
     output += `Phone: +1-${Math.floor(random(seed*11)*900)+100}-${Math.floor(random(seed*12)*900)+100}-${Math.floor(random(seed*13)*9000)+1000}\n`;
     output += `Username: ${first.toLowerCase()}_${last.toLowerCase()}_${Math.floor(random(seed*14)*999)}\n`;
     output += `Password: ${first}${last}${Math.floor(random(seed*15)*999)}!\n`;
     
     res.json({ content: output });
  } catch(e) {
     res.status(500).json({ error: 'Failed to generate fake data' });
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
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) baseUrl = 'https://' + baseUrl;

  const results: any = { isWordPress: false, version: null, endpoints: {}, themes: [], plugins: [] };

  try {
     const checkPath = async (p: string) => {
        try {
           const c = new AbortController();
           const t = setTimeout(() => c.abort(), 2000);
           const r = await fetch(`${baseUrl}${p}`, { method: 'GET', signal: c.signal });
           clearTimeout(t);
           return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
        } catch { return { ok: false, status: 0, text: '' }; }
     };

     const home = await checkPath('/');
     if (home.text.includes('wp-content') || home.text.includes('wp-includes')) {
        results.isWordPress = true;
     }
     
     // Extract version from meta tag
     const match = home.text.match(/name="generator" content="WordPress (.*?)"/i);
     if (match && match[1]) results.version = match[1];

     if (!results.isWordPress) {
        const login = await checkPath('/wp-login.php');
        if (login.ok && login.text.includes('user_login')) results.isWordPress = true;
     }

     if (results.isWordPress) {
        // Enumerate some paths
        const endpoints = ['/wp-login.php', '/xmlrpc.php', '/wp-json/'];
        for (const ep of endpoints) {
           const r = await checkPath(ep);
           results.endpoints[ep] = r.status;
        }

        // Try extracting some plugins from the HTML
        const pluginRegex = /wp-content\/plugins\/([^\/]+)\//g;
        let pMatch;
        const foundP = new Set<string>();
        while ((pMatch = pluginRegex.exec(home.text)) !== null) {
           foundP.add(pMatch[1]);
        }
        results.plugins = Array.from(foundP);

        // Try extracting some themes
        const themeRegex = /wp-content\/themes\/([^\/]+)\//g;
        let tMatch;
        const foundT = new Set<string>();
        while ((tMatch = themeRegex.exec(home.text)) !== null) {
           foundT.add(tMatch[1]);
        }
        results.themes = Array.from(foundT);
     }
     
     res.json(results);
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

// 20. CVE Lookup Proxy
  app.get('/api/net/cve/recent', async (req, res) => {
    try {
       const controller = new AbortController();
       const t = setTimeout(() => controller.abort(), 6000);
       const r = await fetch('https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=15', { 
           signal: controller.signal,
           headers: { 'User-Agent': 'Mozilla/5.0' }
       });
       clearTimeout(t);
       if (!r.ok) throw new Error('Fetch failed');
       const nvdData = await r.json();
       
       if (nvdData?.vulnerabilities) {
           const formatted = nvdData.vulnerabilities.map((v: any) => {
               const cve = v.cve;
               const id = cve?.id || 'Unknown';
               const summary = cve?.descriptions?.find((d: any) => d.lang === 'en')?.value || 'No summary available';
               const cvssData = cve?.metrics?.cvssMetricV31?.[0]?.cvssData || cve?.metrics?.cvssMetricV30?.[0]?.cvssData || cve?.metrics?.cvssMetricV2?.[0]?.cvssData;
               const cvss = cvssData ? cvssData.baseScore : null;
               
               return { id, cvss, summary };
           });
           return res.json(formatted);
       }
       throw new Error('Invalid format');
    } catch (e) {
       // Fallback mock data if NVD fails or rate limits
       res.json([
           { id: "CVE-2024-3094", cvss: 10.0, summary: "Malicious code was discovered in the upstream tarballs of xz, starting with version 5.6.0. The code modifies liblzma to intercept execution and can lead to remote code execution." },
           { id: "CVE-2024-21413", cvss: 9.8, summary: "Microsoft Outlook Remote Code Execution Vulnerability. This vulnerability allows an attacker to bypass the Office Protected View and open a malicious file." },
           { id: "CVE-2023-4863", cvss: 8.8, summary: "Heap buffer overflow in libwebp in Google Chrome prior to 116.0.5845.187 allowed a remote attacker to perform an out of bounds memory write via a crafted HTML page." },
           { id: "CVE-2023-38831", cvss: 7.8, summary: "WinRAR before 6.23 allows attackers to execute arbitrary code when a user attempts to view a benign file within a ZIP archive." },
           { id: "CVE-2021-44228", cvss: 10.0, summary: "Apache Log4j2 JNDI features used in configuration, log messages, and parameters do not protect against attacker controlled LDAP and other JNDI related endpoints." }
       ]);
    }
  });

  app.get('/api/net/cve/search', async (req, res) => {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID is required' });
    const cid = id.trim().toUpperCase();
    try {
       const tc1 = new AbortController();
       const t1 = setTimeout(() => tc1.abort(), 4000);
       const res1 = await fetch(`https://cveawg.mitre.org/api/cve/${cid}`, { signal: tc1.signal });
       clearTimeout(t1);
       if (res1.ok) return res.json({ fallback: false, data: await res1.json() });
       
       const tc2 = new AbortController();
       const t2 = setTimeout(() => tc2.abort(), 4000);
       const res2 = await fetch(`https://cve.circl.lu/api/cve/${cid}`, { signal: tc2.signal });
       clearTimeout(t2);
       if (res2.ok) return res.json({ fallback: true, data: await res2.json() });
       
       res.status(404).json({ error: 'Not found' });
    } catch(e) {
       res.status(500).json({ error: 'Error' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
