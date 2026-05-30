import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';

const FAST_INTERVAL = 2_000;
const SLOW_INTERVAL = 15_000;
const CONSECUTIVE_OK_THRESHOLD = 5;

let webHealthy = false;
let mobileHealthy = false;
let webProcessError = false;
let mobileProcessError = false;
let lastChanged = Date.now();
let consecutiveOk = 0;
let timer = null;

function getProcessState(program) {
  try {
    const output = execSync(`supervisorctl status ${program}`, {
      timeout: 2000,
    }).toString();
    const match = output.match(
      /\b(RUNNING|FATAL|STOPPED|STARTING|BACKOFF|EXITED)\b/
    );
    return match ? match[1] : 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

function tailFile(path, maxBytes = 4096) {
  try {
    const stat = fs.statSync(path);
    const readFrom = Math.max(0, stat.size - maxBytes);
    const buf = Buffer.alloc(Math.min(stat.size, maxBytes));
    const fd = fs.openSync(path, 'r');
    fs.readSync(fd, buf, 0, buf.length, readFrom);
    fs.closeSync(fd);
    return buf.toString('utf-8');
  } catch {
    return '';
  }
}

function runtimeState(healthy, processError) {
  if (healthy) return 'ok';
  if (processError) return 'error';
  return 'unhealthy';
}

function schedule() {
  clearInterval(timer);
  const interval =
    consecutiveOk >= CONSECUTIVE_OK_THRESHOLD ? SLOW_INTERVAL : FAST_INTERVAL;
  timer = setInterval(tick, interval);
}

function markUnhealthy() {
  lastChanged = Date.now();
  const wasStable = consecutiveOk >= CONSECUTIVE_OK_THRESHOLD;
  consecutiveOk = 0;
  if (wasStable) schedule();
}

function checkWeb() {
  return new Promise((resolve) => {
    const req = http.request(
      'http://localhost:4000',
      { method: 'HEAD' },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
    );
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function checkMobile() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8081/status', (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function checkProcessStates() {
  const webState = getProcessState('web');
  if (webState === 'FATAL' || webState === 'BACKOFF') {
    webProcessError = true;
  }

  const mobileState = getProcessState('mobile');
  if (mobileState === 'FATAL' || mobileState === 'BACKOFF') {
    mobileProcessError = true;
  }
}

async function tick() {
  const [web, mobile] = await Promise.all([checkWeb(), checkMobile()]);

  if (web !== webHealthy) {
    lastChanged = Date.now();
    webHealthy = web;
  }
  if (webHealthy) webProcessError = false;

  if (mobile !== mobileHealthy) {
    lastChanged = Date.now();
    mobileHealthy = mobile;
  }
  if (mobileHealthy) mobileProcessError = false;

  checkProcessStates();

  if (webHealthy && mobileHealthy) {
    const wasBelow = consecutiveOk < CONSECUTIVE_OK_THRESHOLD;
    consecutiveOk++;
    if (wasBelow && consecutiveOk >= CONSECUTIVE_OK_THRESHOLD) schedule();
  } else if (consecutiveOk > 0) {
    markUnhealthy();
  }
}

tick();
schedule();

http
  .createServer((req, res) => {
    if (req.url === '/healthz') {
      const webState = runtimeState(webHealthy, webProcessError);
      const mobileState = runtimeState(mobileHealthy, mobileProcessError);
      const isHealthy = webState === 'ok' && mobileState === 'ok';
      const hasError = webState === 'error' || mobileState === 'error';

      const response = {
        status: isHealthy ? 'ok' : hasError ? 'error' : 'unhealthy',
        web: webState,
        mobile: mobileState,
        since: new Date(lastChanged).toISOString(),
      };

      if (webState === 'error') {
        response.webStderr = tailFile('/var/log/web-err.log');
      }
      if (mobileState === 'error') {
        response.mobileStderr = tailFile('/var/log/mobile-err.log');
      }

      res.statusCode = isHealthy ? 200 : 500;
      res.end(JSON.stringify(response));
    } else if (req.url === '/settings') {
      try {
        const settings = fs.readFileSync(
          '/usr/local/bin/settings.json',
          'utf-8'
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(settings);
      } catch {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end('{}');
      }
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  })
  .listen(9000, () => {
    // biome-ignore lint/suspicious/noConsoleLog: This is a healthcheck server, logging is fine.
    console.log('Healthcheck listening on http://localhost:9000');
  });
