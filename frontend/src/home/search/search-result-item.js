import React from 'react';
import PropTypes from 'prop-types';
import { ProjectIcon } from '../../components';

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
    const { color, icon, name, shared_name, type, group_name } = item;
    const pathName = group_name === 'personal' ? gettext('My projects') : group_name;
    return (
      <div className={getClassName} onClick={this.onClickHandler}>
        <ProjectIcon bgColor={color} icon={icon} />
        <div className="project-name">
          <span>{shared_name || name}</span>
          {type === 'shared' && <span className="share-tip">{gettext('Shared')}</span>}
          {pathName && <span className="share-tip text-truncate">{pathName}</span>}
        </div>
      </div>
    );
  }
}

SearchResultItem.propTypes = propTypes;

export default SearchResultItem;
