import { initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { mediaUrl, lang } from '../constants/config';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: lang,
    fallbackLng: 'en',
    ns: ['seafile-editor'],
    defaultNS: 'seafile-editor',
    whitelist: ['en', 'fr', 'de', 'zh-CN'],
    backend: {
      loadPath: mediaUrl + 'locales/{{ ns }}/{{ lng }}.json',
    },
    debug: false, // console log if debug: true
    interpolation: {
      escapeValue: false, // not needed for react!!
    },
    load: 'currentOnly',
    react: {
      wait: true,
    }
  });

export default i18n;
