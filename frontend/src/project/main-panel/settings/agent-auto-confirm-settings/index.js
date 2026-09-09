import React, { useMemo } from 'react';
import { gettext } from '@/constants';
import SettingsItem from '../settings-item';
import SwitchSettings from '../switch-settings';

import './index.css';

const AUTO_CONFIRM_ITEMS = [
  {
    key: 'suggest_notify_assignee',
    title: gettext('Notify assignees'),
    tip: gettext('Automatically send assignee reminders without manual approval.'),
    risk: '',
    defaultValue: true,
  },
  {
    key: 'suggest_create_ticket',
    title: gettext('Create internal ticket'),
    tip: gettext('Automatically create a ticket from AI suggestions.'),
    risk: gettext('Use with caution'),
    defaultValue: false,
  },
];

const AgentAutoConfirmSettings = ({ value = {}, onChange }) => {
  const autoConfirm = useMemo(() => {
    return AUTO_CONFIRM_ITEMS.reduce((acc, item) => {
      const configured = value[item.key];
      acc[item.key] = typeof configured === 'boolean' ? configured : item.defaultValue;
      return acc;
    }, {});
  }, [value]);

  const onToggle = (itemKey, checked) => {
    onChange && onChange({
      ...value,
      [itemKey]: checked,
    });
  };
  return (
    <SettingsItem title={gettext('Auto-approve actions')} className="seaqa-project-auto-approve-action-settings">
      <p className="seaqa-tip-default m-0 font-size-12 line-height-20">
        {gettext('When enabled, matching suggestions are executed automatically without clicking Approve in run logs.')}
      </p>
      {AUTO_CONFIRM_ITEMS.map((item) => (
        <>
          <SwitchSettings
            placeholder={(
              <div className="d-flex align-items-center">
                <div>{item.title}</div>
                {item.risk && <div className="agent-auto-confirm-risk ml-2 px-2">{item.risk}</div>}
              </div>
            )}
            className="mt-4"
            tip={item.tip}
            value={!!autoConfirm[item.key]}
            onChange={(checked) => onToggle(item.key, checked)}
          />
        </>
      ))}
    </SettingsItem>
  );
};

export default AgentAutoConfirmSettings;
