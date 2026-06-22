import { canUseDOM } from './dom';

export const canCheckSeafileEditorBrowser = (browserWindow = canUseDOM ? window : null) => {
  if (!browserWindow) return false;
  if (!browserWindow.chrome) return true;

  const appVersion = browserWindow.navigator?.appVersion;
  if (typeof appVersion !== 'string') return false;

  return appVersion.split(' ').some(version => version.indexOf('Chrome') >= 0);
};
