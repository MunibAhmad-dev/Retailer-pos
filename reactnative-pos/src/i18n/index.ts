import i18next from 'i18next';
import {initReactI18next, useTranslation} from 'react-i18next';

import en from './en';
import ur from './ur';

i18next.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {translation: en},
    ur: {translation: ur},
  },
  interpolation: {
    // React already escapes values — no need for i18next to do it again
    escapeValue: false,
  },
  // Urdu is RTL; consumers can check i18n.language === 'ur' for layout flips
});

export {useTranslation};
export default i18next;
