import React from 'react';
import classNames from 'classnames';
import { gettext } from '@/constants';

const CustomerUsersTabs = ({ activeTab, onChange, customersTab, usersTab }) => {
  const tabs = [
    { key: customersTab, label: gettext('Customers') },
    { key: usersTab, label: gettext('Users') },
  ];

  return (
    <div className="sea-metadata-views portal-customers-users-view-tabs" role="tablist">
      <div className="sea-metadata-views-nav-container no-scroll">
        {tabs.map(tab => (
          <div className="sea-metadata-view-container" key={tab.key}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={classNames('sea-metadata-view-item', { active: activeTab === tab.key })}
              onClick={() => onChange(tab.key)}
            >
              {tab.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerUsersTabs;
