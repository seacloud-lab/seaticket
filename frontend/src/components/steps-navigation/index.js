import React from 'react';
import classnames from 'classnames';
import Icon from '../icon';

import './index.css';

const StepsNavigation = ({
  className,
  steps,
  currentIndex,
}) => {

  return (
    <div className={classnames('steps-navigation', className)}>
      {steps.map((stepItem, index) => {
        const active = index <= currentIndex;
        const isFinished = index < currentIndex;
        return (
          <div className={classnames('step-item', { 'active': active })} key={index}>
            {isFinished ? (<Icon symbol="check-circle" />) : <span>{index + 1}</span>}
            <span>{stepItem.name}</span>
          </div>
        );
      })}
    </div>
  );
};

export default StepsNavigation;
