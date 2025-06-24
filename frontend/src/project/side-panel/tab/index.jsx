import React from 'react';
import classnames from 'classnames';

import './index.css';

const Tab = ({ tab, activeTab, toggleTab }) => {

  const { key, name, children } = tab;
  if (Array.isArray(children) && children.length > 0) {
    return (
      <div className="sea-qa-project-navigation-group" key={key}>
        {name && (<div className="sea-qa-project-navigation-title">{name}</div>)}
        <div className="sea-qa-project-navigation-tabs">
          {children.map(child => (<Tab tab={child} key={child.key} activeTab={activeTab} toggleTab={toggleTab} />))}
        </div>
      </div>
    );
  }

  const isActive = key === activeTab;
  return (
    <div
      className={classnames('sea-qa-project-navigation-tab', { 'sea-qa-project-navigation-tab-active': isActive })}
      key={key}
      onClick={() => toggleTab(key)}
    >
      {name}
    </div>
  );
};

export default Tab;
