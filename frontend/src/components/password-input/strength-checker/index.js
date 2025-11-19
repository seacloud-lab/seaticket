import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Progress } from 'reactstrap';
import { gettext } from '@/constants';
import { evaluatePasswordStrength } from '@/utils/validate';
import { isMobile } from '@/utils/utils';

import './index.css';

const PASSWORD_STRENGTH_VALUES = {
  empty: { classNames: ['default', 'default', 'default', 'default'], textValue: '' },
  weak: { classNames: ['weak', 'default', 'default', 'default'], textValue: 'weak' },
  medium: { classNames: ['medium', 'medium', 'default', 'default'], textValue: 'medium' },
  strong: { classNames: ['strong', 'strong', 'strong', 'default'], textValue: 'strong' },
  very_strong: { classNames: ['very-strong', 'very-strong', 'very-strong', 'very-strong'], textValue: 'very strong' },
};

const StrengthChecker = ({ value }) => {
  const { classNames: progressClassNames = [], textValue = '' } = useMemo(() => PASSWORD_STRENGTH_VALUES[evaluatePasswordStrength(value)] || {}, [value]);
  const labelClassName = Array.isArray(progressClassNames) && progressClassNames.length > 0 ? progressClassNames[0] : '';

  return (
    <div className={classNames('strength-check-container', { 'mobile': isMobile })}>
      <div className="strength-check-box">
        <div className="strength-value">
          <span>{gettext('Password strength')}: </span>
          <span className={labelClassName}>{gettext(textValue)}</span>
        </div>
        <Progress multi>
          {progressClassNames.map((className, index) => (
            <Progress
              bar
              key={index}
              className={className}
              value='25'
            />
          ))}
        </Progress>
        <div className="password-strength-description">
          <span>{gettext('The password should contain different types of characters to make it strong: uppercase letters, lowercase letters, numbers and special characters.')}</span>
        </div>
      </div>
    </div>
  );
};

StrengthChecker.propTypes = {
  value: PropTypes.string.isRequired,
};

export default StrengthChecker;
