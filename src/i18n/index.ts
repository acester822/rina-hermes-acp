import * as vscode from 'vscode';
import { en } from './locales/en';
import { zhCn } from './locales/zh-cn';
import { LocaleKey, LocaleStrings, SupportedLocale } from './types';

const LOCALES: Record<SupportedLocale, LocaleStrings> = {
    en,
    'zh-cn': zhCn,
};

let currentLocale: SupportedLocale = 'en';
let strings: LocaleStrings = en;

export function resolveLocale(language?: string): SupportedLocale {
    const lang = (language ?? vscode.env.language).toLowerCase();
    if (lang === 'zh-cn' || lang === 'zh-hans' || lang.startsWith('zh-cn')) {
        return 'zh-cn';
    }
    return 'en';
}

export function initI18n(language?: string): SupportedLocale {
    currentLocale = resolveLocale(language);
    strings = LOCALES[currentLocale];
    return currentLocale;
}

export function getLocale(): SupportedLocale {
    return currentLocale;
}

export function getWebviewLocale(): LocaleStrings {
    return strings;
}

export function t(key: LocaleKey, ...args: (string | number)[]): string {
    let text = strings[key] ?? en[key] ?? key;
    args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, String(arg));
    });
    return text;
}

/** Map ACP status messages (English from AcpClient) to localized strings. */
export function localizeStatusMessage(msg: string): string {
    if (msg === 'Starting Hermes ACP...') {
        return t('statusStartingAcp');
    }
    if (msg === 'Hermes is thinking...') {
        return t('statusHermesThinking');
    }

    let match = msg.match(/^Process error: (.+)$/);
    if (match) {
        return t('statusProcessError', match[1]);
    }

    match = msg.match(/^Process exited \(code: ([^,]+), signal: ([^)]+)\)$/);
    if (match) {
        return t('statusProcessExited', match[1], match[2]);
    }

    match = msg.match(/^Connection failed: (.+)$/);
    if (match) {
        return t('statusConnectionFailed', match[1]);
    }

    match = msg.match(/^New session failed: (.+)$/);
    if (match) {
        return t('statusNewSessionFailed', match[1]);
    }

    return msg;
}
