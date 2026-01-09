import { useCallback, useState } from 'react';
import { Icon } from '@/components';
import { gettext } from '@/constants';
import ThoughtProcessDialog from './thought-process-dialog';

import './index.css';

const ThoughtProcess = ({ value, settings }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);

  const openDetails = useCallback(() => {
    setIsShowDetails(true);
  }, []);

  if (!settings.developer_mode || !value) return null;

  return (
    <>
      <div className="sea-qa-ai-thought-process-btn" onClick={openDetails}>
        <span className="mr-2">{gettext('Thought process')}</span>
        <Icon symbol="open-in-new-tab" />
      </div>
      {isShowDetails && (
        <ThoughtProcessDialog value={value} onToggle={() => setIsShowDetails(false)} />
      )}
    </>
  );

};

export default ThoughtProcess;
