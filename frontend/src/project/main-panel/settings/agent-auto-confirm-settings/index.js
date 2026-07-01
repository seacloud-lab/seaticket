import React, { useMemo } from 'react';
import classnames from 'classnames';
import { Switch } from '@/components';
import { gettext } from '@/constants';

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

const AgentAutoConfirmSettings = ({ className, value = {}, onChange }) => {
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
    <div className={classnames('agent-auto-confirm-settings w-100 pl-4 pr-4 pt-2', className)}>
      <div className="agent-auto-confirm-header text-truncate mb-2">
        {gettext('Auto-approve actions')}
      </div>
      <p className="seaqa-tip-default tip m-0 mb-3">
        {gettext('When enabled, matching suggestions are executed automatically without clicking Approve in run logs.')}
      </p>
      <div className="agent-auto-confirm-body">
        {AUTO_CONFIRM_ITEMS.map((item) => (
          <div className="agent-auto-confirm-row d-flex align-items-center justify-content-between" key={item.key}>
            <div className="agent-auto-confirm-meta pr-3">
              <div className="agent-auto-confirm-title d-flex align-items-center">
                <span>{item.title}</span>
                {item.risk && <span className="agent-auto-confirm-risk ml-2">{item.risk}</span>}
              </div>
              <p className="seaqa-tip-default tip m-0">{item.tip}</p>
            </div>
            <Switch
              checked={!!autoConfirm[item.key]}
              onChange={(event) => onToggle(item.key, event.target.checked)}
              size="large"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentAutoConfirmSettings;
