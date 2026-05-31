import { Linking, Alert } from 'react-native';

// ── Phone formatting ──────────────────────────────────────────────────────────

/**
 * Normalises a Pakistani phone number to the E.164-compatible format
 * expected by WhatsApp: 923XXXXXXXXX (no + sign in the URL param itself).
 *
 * Handles inputs such as:
 *   03001234567  → 923001234567
 *   923001234567 → 923001234567
 *   +923001234567→ 923001234567
 *   3001234567   → 923001234567
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Already has country code
  if (digits.startsWith('92') && digits.length >= 12) {
    return digits;
  }

  // Local format: leading 0 (e.g. 03001234567)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return `92${digits}`;
}

// ── URL builders ─────────────────────────────────────────────────────────────

/**
 * Builds a deep-link URL that opens WhatsApp with a pre-filled message.
 * Uses the whatsapp:// scheme which works on both Android and iOS.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalised = formatPhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  return `whatsapp://send?phone=${normalised}&text=${encoded}`;
}

/**
 * Builds an SMS deep-link URL.
 * Android: sms:03001234567?body=...
 * iOS:     sms:03001234567&body=...  (Linking handles it the same way)
 */
export function buildSMSUrl(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `sms:${phone}?body=${encoded}`;
}

// ── Openers ───────────────────────────────────────────────────────────────────

/**
 * Opens WhatsApp with a pre-filled message.
 * Shows an alert if WhatsApp is not installed.
 */
export async function openWhatsApp(phone: string, message: string): Promise<void> {
  const url = buildWhatsAppUrl(phone, message);
  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    Alert.alert(
      'WhatsApp Not Found',
      'WhatsApp is not installed on this device. Please install it and try again.',
      [{ text: 'OK' }],
    );
    return;
  }

  await Linking.openURL(url);
}

/**
 * Opens the native phone dialer with the given number pre-filled.
 */
export function openDialer(phone: string): void {
  Linking.openURL(`tel:${phone}`).catch(() => {
    Alert.alert('Error', 'Could not open the dialer.');
  });
}

/**
 * Opens the native SMS app with a pre-filled message.
 */
export function sendSMS(phone: string, message: string): void {
  const url = buildSMSUrl(phone, message);
  Linking.openURL(url).catch(() => {
    Alert.alert('Error', 'Could not open the SMS app.');
  });
}

// ── Message templates ─────────────────────────────────────────────────────────

/** English balance reminder */
export function getBalanceReminderEN(name: string, amount: number): string {
  return (
    `Dear ${name}, you have an outstanding balance of PKR ${amount.toLocaleString('en-PK')}. ` +
    `Please make the payment at your earliest convenience. Thank you.`
  );
}

/** Urdu balance reminder */
export function getBalanceReminderUR(name: string, amount: number): string {
  return (
    `السلام علیکم ${name}، آپ کے ذمہ Rs. ${amount.toLocaleString('en-PK')} روپے بقایا ہیں۔ ` +
    `براہ کرم جلد ادائیگی کریں۔ شکریہ`
  );
}

/** English payment / invoice reminder */
export function getPaymentReminderEN(name: string, amount: number): string {
  return (
    `Dear ${name}, this is a reminder that your payment of PKR ${amount.toLocaleString('en-PK')} ` +
    `is due. Please settle the amount as soon as possible. Thank you.`
  );
}

/** Urdu payment / invoice reminder */
export function getPaymentReminderUR(name: string, amount: number): string {
  return (
    `السلام علیکم ${name}، آپ کو یاد دلایا جاتا ہے کہ Rs. ${amount.toLocaleString('en-PK')} ` +
    `کی ادائیگی باقی ہے۔ براہ کرم جلد از جلد رقم ادا کریں۔ شکریہ`
  );
}
