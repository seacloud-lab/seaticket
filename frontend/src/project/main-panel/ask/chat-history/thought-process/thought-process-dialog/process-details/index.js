import { useState, useCallback } from 'react';
import { FormGroup, Label } from 'reactstrap';
import classnames from 'classnames';
import { IconButton, RadioGroup, Icon } from '@/components';
import { gettext } from '@/constants';
import { hasOwnProperty } from '@/utils/object-utils';
import { getType } from '@/utils/type-detection';
import { THOUGHT_PROCESS_TYPE } from '../../../../constants';

import './index.css';

const rawOptions = [
  { value: 'normal', label: gettext('Normal') },
  { value: 'raw', label: gettext('Raw') },
];

const ProcessDetails = ({ value, primaryKey }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);
  const [displayType, setDisplayType] = useState('normal');

  const toggle = useCallback(() => {
    setIsShowDetails(!isShowDetails);
  }, [isShowDetails]);

  if (!value) return null;

  const valueType = getType(value);

  if (valueType === 'String') {
    if (primaryKey === THOUGHT_PROCESS_TYPE.STATISTICS.key) {
      const children = value.split('/').map((item, index) => {
        const child = item.split(':');
        return (
          <Label key={index} className="sea-qa-ai-thought-process-content-title">
            <span className="description">{child[0]}:</span>
            <span className="value">{child[1]}</span>
          </Label>
        );
      });
      return <div className="d-flex">{children}</div>;
    }
    return (
      <Label className="sea-qa-ai-thought-process-content-title">{value}</Label>
    );
  }

  if (valueType !== 'Object') return null;

  const hasChildren = hasOwnProperty(value, 'children');
  const hasRawChildren = hasOwnProperty(value, 'rawChildren');
  const hasName = hasOwnProperty(value, 'name');
  if (hasChildren) {
    const children = displayType === 'raw' ? value.rawChildren : value.children;
    const { isPrimaryContainer, name, icon, key: primaryKey } = value;
    const orderClassName = classnames('sea-qa-ai-thought-process-order', { 'primary-order-container': isPrimaryContainer, 'has-content': isShowDetails }, primaryKey);
    const arrowClassName = classnames('no-hover-bg', { 'rotate-icon-180': isShowDetails });
    const contentClassName = classnames('sea-qa-ai-thought-process-content', { 'primary-content-container': isPrimaryContainer }, primaryKey);

    return (
      <>
        <div className={orderClassName} onClick={toggle} >
          {!isPrimaryContainer && <IconButton icon="arrow-down" className={arrowClassName} />}
          <span className="sea-qa-ai-thought-process-order-title">
            {isPrimaryContainer && <Icon symbol={icon} />}
            {name}
          </span>
          {isPrimaryContainer && <IconButton icon="arrow-down" className={arrowClassName} />}
        </div>

        {isShowDetails && (
          <div className={contentClassName}>
            {hasRawChildren && (
              <RadioGroup value={displayType} options={rawOptions} onChange={setDisplayType} />
            )}
            {children.map((child, childIndex) => (
              <ProcessDetails value={child} key={childIndex} primaryKey={primaryKey} />
            ))}
          </div>
        )}
      </>
    );
  }

  const Formatter = value.formatter;

  return (
    <FormGroup>
      {hasName && (<Label className="sea-qa-ai-thought-process-content-title">{value.name}</Label>)}
      {Formatter && value.value ? (
        <Formatter value={value.value} className="sea-qa-ai-thought-process-content-value" />
      ) : (
        <div className="sea-qa-ai-thought-process-content-value">
          {(value.value || value.value === 0) ? value.value : (
            <span className="sea-qa-tip-default">{gettext('Empty')}</span>
          )}
        </div>
      )}
    </FormGroup>
  );
};

export default ProcessDetails;
