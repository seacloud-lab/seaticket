import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { aiCreditExceededAmount } from '@/constants/config';
import { gettext } from '../../../../constants';
import { IconButton, Icon } from '@/components';

import './org-ai-limit-prompt.css';

const OrgAiLimitPrompt = (props) => {
  const { isDesktop } = props;
  const [show, setShow] = useState(aiCreditExceededAmount > 0);

  if (!show) return null;

  const limitText = gettext('AI credit limit exceeded — You’ve used %s credits beyond your limit. Add credits now to restore full access.').replace('%s', aiCreditExceededAmount);

  return (
    <div className={`org-ai-limit-wrapper d-flex justify-content-between align-items-center ${isDesktop ? '' : 'mobile-org-ai-limit-wrapper'}`}>
      <div className="org-ai-limit-name d-flex align-items-center">
        <Icon symbol="exclamation-circle-stroked"/>
        <span className="org-ai-limit-text">
          {limitText}
        </span>
      </div>
      <IconButton icon="close" className="org-ai-limit-close" onClick={() => setShow(false)} />
    </div>
  );
};

OrgAiLimitPrompt.propTypes = {
  isDesktop: PropTypes.bool.isRequired,
  onCreateGroupToggle: PropTypes.func,
};

export default OrgAiLimitPrompt;
