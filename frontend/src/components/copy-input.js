import React from 'react';
import copy from 'copy-to-clipboard';
import { Input, InputGroup, Button } from 'reactstrap';
import IconButton from './icon-button/index';
import toaster from './toaster';

const CopyInput = ({ value }) => {
  const copyLink = () => {
    copy(value);
    const message = window.gettext('Connection URL has been copied to clipboard');
    toaster.success((message), {
      duration: 2
    });
  };
  return (
    <InputGroup>
      <Input value={value} disabled={true} />
      <Button onClick={copyLink}>
        <IconButton
          disabled={true}
          icon="copy"
          className="p-0"
        />
      </Button>
    </InputGroup>
  );
};

export default CopyInput;
