import * as Sentry from '@sentry/node';

const LIMITS = {
  rpm: parseInt(process.env.GEMINI_RPM_LIMIT || '15', 10),
  rpd: parseInt(process.env.GEMINI_RPD_LIMIT || '1500', 10),
};

let currentRpm = 0;
let currentRpd = 0;
let lastMinReset = Date.now();
let lastDayReset = Date.now();

let alertSentMin = false;
let alertSentDay = false;

export function incrementGeminiUsage() {
  const now = Date.now();
  
  // Reset RPM every minute
  if (now - lastMinReset > 60 * 1000) {
    currentRpm = 0;
    lastMinReset = now;
    alertSentMin = false;
  }
  
  // Reset RPD every day
  if (now - lastDayReset > 24 * 60 * 60 * 1000) {
    currentRpd = 0;
    lastDayReset = now;
    alertSentDay = false;
  }

  currentRpm++;
  currentRpd++;

  // Cảnh báo nếu đạt 80% quota phút
  if (currentRpm >= LIMITS.rpm * 0.8 && !alertSentMin) {
    const msg = `[QUOTA ALERT] Đã đạt ${currentRpm}/${LIMITS.rpm} Gemini requests/phút (>= 80%)`;
    console.warn(msg);
    Sentry.captureMessage(msg, 'warning');
    alertSentMin = true;
  }
  
  // Cảnh báo nếu đạt 80% quota ngày
  if (currentRpd >= LIMITS.rpd * 0.8 && !alertSentDay) {
    const msg = `[QUOTA ALERT] Đã đạt ${currentRpd}/${LIMITS.rpd} Gemini requests/ngày (>= 80%)`;
    console.warn(msg);
    Sentry.captureMessage(msg, 'warning');
    alertSentDay = true;
  }
}

export function getQuotaStatus() {
  return {
    rpm: { current: currentRpm, limit: LIMITS.rpm },
    rpd: { current: currentRpd, limit: LIMITS.rpd }
  };
}
