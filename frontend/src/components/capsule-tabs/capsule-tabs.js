import React, { useState } from 'react';
import { ButtonGroup, Button } from 'reactstrap';

import './capsule-tabs.css';

const CapsuleTabs = ({ tabs = [], defaultActiveIndex = 0, onTabChange }) => {
  const [activeTab, setActiveTab] = useState(defaultActiveIndex);
  const handleTabClick = (index) => {
    setActiveTab(index);
    onTabChange?.(index);
  };
  return (
    <ButtonGroup className="capsule-tabs-group">
      {tabs.map((tab, index) => (
        <Button
          key={index}
          className={`capsule-tab ${index === activeTab ? 'active' : ''}`}
          onClick={() => handleTabClick(index)}
        >
          {tab.label}
        </Button>
      ))}
    </ButtonGroup>
  );
};

export default CapsuleTabs;
