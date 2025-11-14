import { useState, useCallback } from 'react';
import { FormGroup, Label } from 'reactstrap';
import classnames from 'classnames';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import { hasOwnProperty } from '@/utils/object-utils';

import './index.css';
import { getType } from '@/utils/type-detection';


const ToolCallDetails = ({ value }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);

  const toggle = useCallback(() => {
    setIsShowDetails(!isShowDetails);
  }, [isShowDetails]);

  if (!value) return null;

  const valueType = getType(value);

  if (valueType === 'String') {
    return (
      <Label className="sea-qa-ai-tool-calls-content-title">{value}</Label>
    );
  }

  if (valueType !== 'Object') return null;

  const hasChildren = hasOwnProperty(value, 'children');
  const hasName = hasOwnProperty(value, 'name');
  if (hasChildren) {
    return (
      <>
        <div className="sea-qa-ai-tool-calls-order" onClick={toggle}>
          <IconButton icon="down" className={classnames('no-hover-bg', { 'rotate-icon-270': !isShowDetails })}/>
          <span className="sea-qa-ai-tool-calls-order-title">
            {value.name}
          </span>
        </div>
        {isShowDetails && (
          <div className="sea-qa-ai-tool-calls-content">
            {value.children.map((child, childIndex) => (
              <ToolCallDetails value={child} key={childIndex} />
            ))}
          </div>
        )}
      </>
    );
  }

  const Formatter = value.formatter;

  return (
    <FormGroup>
      {hasName && (<Label className="sea-qa-ai-tool-calls-content-title">{value.name}</Label>)}
      {Formatter && value.value ? (
        <Formatter value={value.value} className="sea-qa-ai-tool-calls-content-value" />
      ) : (
        <div className="sea-qa-ai-tool-calls-content-value">
          {(value.value || value.value === 0) ? value.value : (
            <span className="sea-qa-tip-default">{gettext('Empty')}</span>
          )}
        </div>
      )}
    </FormGroup>
  );
};

export default ToolCallDetails;
