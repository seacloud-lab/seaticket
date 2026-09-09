import React from 'react';
import { FormGroup, Label } from 'reactstrap';
import classnames from 'classnames';
import { IconTooltip } from '@/components';
import { gettext } from '@/constants';
import Editor from './editor';

import './index.css';

const ConnectionConfigEditor = ({ column, className, ...props }) => {
  const { key, tip, name, is_required } = column;
  return (
    <FormGroup key={key} className={className}>
      <Label>
        {name}
        {is_required && (<span className="required-tip" title={gettext('Required')}>{'*'}</span>)}
        {tip && (
          <IconTooltip
            tip={tip}
            icon="question-circle-stroked"
            className={classnames('connection-config-tip-btn', { 'ml-0': is_required })}
          />)}
      </Label>
      <Editor { ...props } column={column} />
    </FormGroup>
  );
};

export default ConnectionConfigEditor;
