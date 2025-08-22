import classnames from 'classnames';
import RemoveBtn from './remove-btn';

import './index.css';

const Tag = ({ tag, children, className }) => {

  return (
    <div key={tag.id} className={classnames('sea-metadata-tag', className)} title={tag.name}>
      <span className="sea-metadata-tag-color mr-1" style={{ backgroundColor: tag.color }}></span>
      <span className="sea-metadata-tag-text">{tag.name}</span>
      {children}
    </div>
  );
};

Tag.RemoveBtn = RemoveBtn;

export default Tag;
export {
  RemoveBtn
};
