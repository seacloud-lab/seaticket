import i18n from 'i18next';
import Backend from 'i18next-xhr-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

let mediaUrl = window.app.config.mediaUrl;
const lang = window.app.config.lang;
const version = window.app.config.version;

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: lang,
    fallbackLng: 'en',
    ns: ['dtable', 'seafile-editor'],
    defaultNS: 'dtable',

    whitelist: ['en', 'zh-CN', 'fr', 'de', 'es', 'pt', 'ru'],

    backend: {
      loadPath: mediaUrl + 'locales/{{ lng }}/{{ ns }}.json',
      // loadPath: '/media/locales/{{lng}}/{{ns}}.json',
      queryStringParams: { v: version }
    },

    debug: false, // console log if debug: true

    interpolation: {
      escapeValue: false, // not needed for react!!
    },
    contextSeparator: ' ',


    load: 'currentOnly',

    react: {
      wait: true,
    }
  });

export default i18n;
