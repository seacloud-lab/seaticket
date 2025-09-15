import { useCallback, useState } from 'react';
import { Icon } from '@/components';
import { gettext } from '@/constants';
import ThoughtProcessDialog from './thought-process-dialog';

import './index.css';

const ThoughtProcess = ({ message }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);

  const openDetails = useCallback(() => {
    setIsShowDetails(true);
  }, []);

  if (!message) return null;

  return (
    <>
      <div className="sea-qa-ai-thought-process-btn" onClick={openDetails}>
        <span className="mr-2">{gettext('Thought process')}</span>
        <Icon symbol="open-in-new" />
      </div>
      {isShowDetails && (
        <ThoughtProcessDialog value={message.value} onToggle={() => setIsShowDetails(false)} />
      )}
    </>
  );

};

export default ThoughtProcess;
