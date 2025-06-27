import React from 'react';
import PropTypes from 'prop-types';
import ProjectIcon from '../workspace/body/project-icon';

const gettext = window.gettext;

const propTypes = {
  item: PropTypes.object.isRequired,
  onItemClickHandler: PropTypes.func.isRequired,
  getClassName: PropTypes.string.isRequired,
  path: PropTypes.string,
};

class SearchResultItem extends React.Component {

  onClickHandler = () => {
    this.props.onItemClickHandler(this.props.item);
  };

  render() {
    const { item, getClassName } = this.props;
    const { color, icon, starred, name, shared_name, type, is_encrypted, group_name } = item;
    const pathName = group_name === 'personal' ? gettext('My projects') : group_name;
    return (
      <div className={getClassName} onClick={this.onClickHandler}>
        <ProjectIcon bgColor={color} icon={icon} />
        <div className="project-name">
          <span>{shared_name || name}</span>
          {type === 'shared' && <span className="share-tip">{gettext('Shared')}</span>}
          {pathName && <span className="share-tip text-truncate">{pathName}</span>}
          {starred && <span className='dtable-font dtable-icon-star star'/>}
          {is_encrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
        </div>
      </div>
    );
  }
}

SearchResultItem.propTypes = propTypes;

export default SearchResultItem;
