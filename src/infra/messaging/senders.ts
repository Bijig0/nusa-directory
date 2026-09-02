/** Ports for outbound messages. Console adapters are used whenever a provider token is missing. */
export interface OtpMessage {
  destination: string;
  code: string;
  locale: 'id' | 'en';
  brand: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface OtpSender {
  sendOtp: (m: OtpMessage) => Promise<void>;
  sendText: (destination: string, text: string) => Promise<void>;
}

export interface EmailSender {
  send: (m: EmailMessage) => Promise<void>;
}

export const otpText = (m: OtpMessage): string =>
  m.locale === 'en'
    ? `${m.brand}: your login code is ${m.code}. It expires in 10 minutes. Do not share it.`
    : `${m.brand}: kode masuk Anda ${m.code}. Berlaku 10 menit. Jangan bagikan ke siapa pun.`;

export const consoleOtpSender: OtpSender = {
  sendOtp: async (m) => {
    console.log(`[otp] to=${m.destination} code=${m.code}`);
  },
  sendText: async (destination, text) => {
    console.log(`[wa] to=${destination} text=${text}`);
  },
};

export const consoleEmailSender: EmailSender = {
  send: async (m) => {
    console.log(`[email] to=${m.to} subject=${m.subject}\n${m.text}`);
  },
};
