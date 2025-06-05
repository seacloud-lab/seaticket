import { mediaUrl } from '../../../../utils/constants';

const APP_ICON_CLASSNAMES = [
  'default',
  'sales-management',
  'staff-management',
  'project-management',
  'financial-management',
  'enterprise-portal',
  'supply-chain-management',
  'purchasing-management',
  'contract-management',
  'information-management',
  'warehouse-management',
  'it-portal',
  'performance-evaluation',
];

export default function getAppIconUrl(iconClass, isCustom, iconLink) {
  if (isCustom) {
    return iconLink;
  } else if (iconClass) {
    // Compatible with old version
    if (!APP_ICON_CLASSNAMES.includes(iconClass)) {
      return `${mediaUrl}img/app-universal/${APP_ICON_CLASSNAMES[0]}.png`;
    }
    return `${mediaUrl}img/app-universal/${iconClass}.png`;
  } else {
    return `${mediaUrl}img/app-universal/${APP_ICON_CLASSNAMES[0]}.png`;
  }
}
