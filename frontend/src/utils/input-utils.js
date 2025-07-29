import getEventTransfer from './get-event-transfer';

class InputUtils {

  onInsertElement = ({ inputRef, selection, range, content, nodeType }) => {
    if (range) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return this.createHtmlElement({ inputRef, selection, range, content, nodeType });
  };

  getHtmlElement = (nodeType, content) => {
    switch (nodeType) {
      case 'image': {
        let parentElement = document.createElement('div');
        parentElement.className = 'image-container';
        parentElement.contentEditable = 'false';
        let imageContainer = document.createElement('img');
        imageContainer.src = content;
        imageContainer.height = 60;
        parentElement.appendChild(imageContainer);
        return parentElement.outerHTML;
      }
      default: {
        return '';
      }
    }
  };

  createHtmlElement = ({ inputRef, selection, range, content, nodeType }) => {
    let spanNode1;
    let spanNode2;
    let imageContainer;

    if (nodeType === 'image') {
      spanNode1 = document.createElement('div');
      spanNode1.className = 'image-container';
      spanNode1.contentEditable = 'false';
      imageContainer = document.createElement('img');
      imageContainer.src = content;
      imageContainer.height = 60;
      spanNode1.appendChild(imageContainer);
      spanNode2 = document.createElement('span');
      spanNode2.innerHTML = ' ';
    }

    if (nodeType === 'collaborator') {
      spanNode1 = document.createElement('span');
      spanNode2 = document.createElement('span');
      spanNode1.className = 'at-text';
      spanNode1.contentEditable = 'true';
      spanNode1.innerHTML = content.name;
      spanNode2.innerHTML = ' ';
    }

    let frag = document.createDocumentFragment();
    let lastNode;
    frag.appendChild(spanNode1);
    lastNode = frag.appendChild(spanNode2.firstChild);
    if (range) {
      range.insertNode(frag);
    } else {
      inputRef.current.appendChild(frag);
      range = selection.getRangeAt(0);
    }
    if (lastNode) {
      range = range.cloneRange();
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return range;
  };

  onSelectCollaborator = ({ selection, range, collaborator, callBack, inputRef }) => {
    if (range) {
      // delete '@xxx';
      selection.removeAllRanges();
      selection.addRange(range);
      const textNode = range.startContainer;
      const atIndex = this.getAtIndexWithAnchorPosition(range.startOffset, textNode.data);
      if (atIndex > -1) {
        range.setStart(textNode, atIndex);
        range.setEnd(textNode, range.endOffset);
        range.deleteContents();
      }
    }
    let newRange = this.createHtmlElement({ selection, range, content: collaborator, nodeType: 'collaborator', inputRef });
    if (callBack) {
      callBack();
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
    return newRange;
  };

  /**
   * get the index of '@' from anchor position.
   * @param {*} anchorPosition '@text|anchor position|'
   * @param {*} text '@abc'
   * @returns index
   * e.g. '@abc|anchor position|' // 0
   *      '@123 @|anchor position| @abc' // 5
   */
  getAtIndexWithAnchorPosition = (anchorPosition, text) => {
    let atIndex = -1;
    for (let i = anchorPosition - 1; i > -1; i--) {
      if (text[i] === '@') {
        atIndex = i;
        break;
      }
    }
    return atIndex;
  };

  onPaste = (event, callBack) => {
    event.stopPropagation();
    const clipboardData = getEventTransfer(event);
    if (clipboardData.files) {
      event.preventDefault();
      if (callBack) {
        callBack(clipboardData.files);
      }
      return;
    }
    event.preventDefault();
    const text = clipboardData.text;
    if (document.queryCommandSupported('insertText')) {
      document.execCommand('insertText', false, text);
    } else {
      document.execCommand('paste', false, text);
    }
  };

}

export default InputUtils;
