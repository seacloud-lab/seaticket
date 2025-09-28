const zhCN = require('@seafile/seafile-calendar/lib/locale/zh_CN');
const enUS = require('@seafile/seafile-calendar/lib/locale/en_US');

function translateCalendar() {
  const locale = window.app.config ? window.app.config.lang : 'en';
  let language;
  switch (locale) {
    case 'zh-cn':
      language = zhCN;
      break;
    case 'en':
      language = enUS;
      break;
    default:
      language = enUS;
  }
  return language;
}


export { translateCalendar };
