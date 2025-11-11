import React from 'react';
import { FormGroup, Label } from 'reactstrap';
import { gettext } from '@/constants';
import { IconTooltip } from '@/components';
import Editor from './editor';
import './index.css';

const ConnectionConfigEditor = ({ column, className, ...props }) => {
  const { key, tip, name, is_required } = column;
  return (
    <FormGroup key={key} className={className}>
      <Label>
        {name}
        {is_required && (<span className="required-tip" title={gettext('Required')}>{'*'}</span>)}
        {tip && (<IconTooltip tip={tip} className={is_required ? 'ml-0' : ''} />)}
      </Label>
      <Editor { ...props } column={column} />
    </FormGroup>
  );
};

export default ConnectionConfigEditor;
