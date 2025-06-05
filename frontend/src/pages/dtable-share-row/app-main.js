import React from 'react';
import PropTypes from 'prop-types';
import RowItem from './row-item';
import Loading from '../../components/loading';
import { dtableWebAPI } from '../../api/dtable-web-api';

const { workspaceID, dtableName } = window.shared.pageOptions;

const propTypes = {
  mode: PropTypes.oneOf(['grid_mode', 'form_mode', 'grally_mode', 'calender_mode', 'kanban_mode']),
  row: PropTypes.object.isRequired,
  columns: PropTypes.array.isRequired,
};

class AppMain extends React.Component {

  static defaultProps = {
    mode: 'form_mode',
  };

  constructor(props) {
    super(props);
    this.state = {
      isLoadingCollaborator: true,
    };
  }

  componentDidMount() {
    dtableWebAPI.getTableRelatedUsers(workspaceID, dtableName).then(res => {
      let collaborators = res.data ? res.data.user_list : [];
      window.app = window.app ? window.app : {};
      window.app.collaborators = collaborators;
      this.setState({ isLoadingCollaborator: false });
    });
  }

  renderRowItems = () => {
    let { row, columns } = this.props;
    let rows = [];
    columns.forEach((column, index) => {
      let value = row[column.key];
      let rowItem = <RowItem key={index} value={value} column={column}/>;
      rows.push(rowItem);
    });
    return rows;
  };

  render() {

    if (this.state.isLoadingCollaborator) {
      return <Loading />;
    }

    let title = this.props.row['0000'];
    return (
      <div className="app-main">
        <div className={`${this.props.mode} dtable-share-row-container`}>
          <div className="dtable-share-row-title"><h3>{title}</h3></div>
          <div className="dtable-share-row-items">
            {this.renderRowItems()}
          </div>
        </div>
      </div>
    );
  }
}

AppMain.propTypes = propTypes;

export default AppMain;
