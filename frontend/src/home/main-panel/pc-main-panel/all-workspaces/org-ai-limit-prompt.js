import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import userAPI from '@/api/user-api';
import { Utils } from '@/utils/utils';
import { gettext } from '../../../../constants';
import { IconButton, Icon, toaster } from '@/components';

import './org-ai-limit-prompt.css';

const OrgAiLimitPrompt = (props) => {
  const { isDesktop } = props;
  const [show, setShow] = useState(false);
  const [creditUsed, setCreditUsed] = useState(0);

  useEffect(() => {
    userAPI.getAILimitInfo().then(res => {
      const { is_exceed, ai_credit_used } = res.data;
      setShow(is_exceed);
      setCreditUsed(ai_credit_used);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, []);

  if (!show) return null;

  const limitText = gettext('AI credits over limit — You are %s credits over your limit. Replenish your credits now to resume full service.').replace('%s', creditUsed);

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
