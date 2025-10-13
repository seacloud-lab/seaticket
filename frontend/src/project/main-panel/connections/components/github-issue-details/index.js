import { Modal, ModalBody } from 'reactstrap';
import dayjs from 'dayjs';
import { EmptyTip, ModalHeader } from '@/components';
import { mediaUrl } from '@/constants';

import './index.css';

const GithubIssueDetails = ({ rowDetailsTitle, rowDetails, onClose }) => {

  return (
    <Modal className='sea-qa-github-issue-details-container' isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>{rowDetailsTitle}</ModalHeader>
      <ModalBody>
        <div className='sea-qa-github-issue-row-details'>
          {!rowDetails.length && <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />}
          {rowDetails.map(detail => (
            <div key={detail.id} className='sea-qa-github-issue-reply-item'>
              <div className='sea-qa-github-issue-reply-item-author-info-wrapper'>
                <div className='sea-qa-github-issue-reply-item-author-info-left'>
                  <div className='sea-qa-github-issue-reply-item-author-avatar'>
                    <img alt='' src={`${mediaUrl}avatars/default.png`}/>
                  </div>
                  <div className='sea-qa-github-issue-reply-item-author-name'>{detail.author}</div>
                </div>
                <div className='sea-qa-github-issue-reply-item-author-time'>{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
              </div>
              <div className='sea-qa-github-issue-reply-item-content' dangerouslySetInnerHTML={{ __html: detail.body }}></div>
            </div>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default GithubIssueDetails;
