import React, { useCallback } from 'react';
import { Icon, toaster } from '@/components';
import { gettext, PROJECT_ICON_COLORS } from '@/constants';
import { portalAPI } from '@/portal/api';
import PortalColorEditor from '@/portal/setting-panel/portal-color-editor';
import { Utils } from '@/utils/utils';

import './theme-color.css';

const { projectUuid } = window.app.pageOptions;

const ThemeColor = ({ portalThemeColor, setPortalThemeColor }) => {
  const isCustomColor = !PROJECT_ICON_COLORS.includes(portalThemeColor);

  const updatePortalThemeColor = useCallback((color) => {
    portalAPI.updateSettings(projectUuid, { portal_theme_color: color }).then(() => {
      setPortalThemeColor(color);
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [setPortalThemeColor]);

  return (
    <section className="portal-appearance-section p-4">
      <div className="portal-appearance-section-title">{gettext('Theme color')}</div>
      <div className="portal-appearance-section-desc mb-3">{gettext('Used for navigation, buttons, links, and card icons')}</div>
      <div className="portal-appearance-theme-colors d-flex flex-wrap align-items-center gap-1 mb-3">
        {PROJECT_ICON_COLORS.map((color) => {
          const isSelected = color === portalThemeColor;
          return (
            <button
              key={color}
              type="button"
              className="portal-appearance-theme-color-item d-flex align-items-center justify-content-center"
              onClick={() => updatePortalThemeColor(color)}
              title={`${gettext('Color')} ${color}`}
              aria-label={`${gettext('Color')} ${color}`}
              aria-pressed={isSelected}
            >
              <span className="portal-appearance-theme-color d-flex align-items-center justify-content-center" style={{ backgroundColor: color }}>
                {isSelected && <Icon symbol="check-mark" className="portal-appearance-theme-color-check" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="portal-appearance-custom-color-title mb-2">{gettext('Custom color')}</div>
      <PortalColorEditor
        color={portalThemeColor}
        isSelected={isCustomColor}
        onChange={updatePortalThemeColor}
      />
    </section>
  );
};

export default ThemeColor;
