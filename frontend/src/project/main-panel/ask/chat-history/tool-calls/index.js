import { useCallback, useState } from 'react';
import { Icon } from '@/components';
import { gettext } from '@/constants';
import ToolCallsDialog from './tool-calls-dialog';

import './index.css';

const ToolCalls = ({ value }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);

  const openDetails = useCallback(() => {
    setIsShowDetails(true);
  }, []);

  if (!value) return null;

  return (
    <>
      <div className="sea-qa-ai-tool-calls-btn" onClick={openDetails}>
        <span className="mr-2">{gettext('Tool calls')}</span>
        <Icon symbol="open-in-new" />
      </div>
      {isShowDetails && (
        <ToolCallsDialog value={value} onToggle={() => setIsShowDetails(false)} />
      )}
    </>
  );

};

export default ToolCalls;
