(function(exports) {

var PashAutoComplete = function(pash){
  this.pash = pash;
  pash.addListener("textChanged", this.textChanged, this);
  pash.addListener("keydown", this.keyDown, this);
  pash.addListener("caretPositionChanged", this.caretPositionChanged, this);
  this.createDom();
};

PashAutoComplete.prototype = {
  eachListItem: function(callback, scope){
    var listDom = this.listDom;
    var childNodes = listDom.childNodes;
    var i, n = childNodes.length;
    for (i = 0; i < n; i++) {
      if (callback.call(scope || null, i, childNodes[i]) === false) {
        return false;
      }
    }
    return true;
  },
  getSelectedListItem: function(){
    var item;
    if (this.eachListItem(function(i, node){
      if (node.className === "selected"){
        item = node;
        return false;
      }
    }, this) !== false){
      item = null;
    }
    return item;
  },
  getListItem: function(i){
    var listDom = this.listDom;
    var childNodes = listDom.childNodes;
    var item;
    if (i < childNodes.length) {
      item = childNodes[i];
    }
    else {
      item = null;
    }
    return item;
  },
  selectNextOrPreviousItem: function(nextOrPrevious){
    var ret;
    if(this.eachListItem(function(i, node){
      if (node.className === "selected") {
        var item = this.getListItem(i + nextOrPrevious);
        if (item) {
          node.className = "";
          item.className = "selected";
          return false;
        }
      }
    }, this) === false) {
      ret = true;
    }
    else {
      ret = false;
    }
    return ret;
  },
  selectNext: function(){
    return this.selectNextOrPreviousItem(1);
  },
  selectPrevious: function(){
    return this.selectNextOrPreviousItem(-1);
  },
  keyDown: function(source, event, data){
    var ret;
    if (this.isListShown()) {
      ret = false;
      var keyCode = data.keyCode;
      switch (keyCode) {
        case 9:
        case 13:
          this.enterSelectedWord();
          break;
        case 38:  //up arrow
          this.selectPrevious();
          break;
        case 40:  //down arrow
          this.selectNext();
          break;
        default:
          ret = true;
      }
    }
    else {
      ret = true;
    }
    return ret;
  },
  enterSelectedWord: function(){
    var item = this.getSelectedListItem();
    if (item === null) {
      return;
    }
    var word = item.innerHTML;
    var pash = this.pash;
    var line = pash.getCurrentLine();
    var text = pash.replaceNbsp(pash.getLineTextString(line));
    var position = Math.min(pash.getCaretPosition(), text.length);
    var textTo = text.substr(0, position);
    var tokenPartRegex = /(\b|\s*|^)?(\w*)$/;
    var tokenPart = tokenPartRegex.exec(textTo);
    if (!tokenPart){
      debugger;
    }
    tokenPart = tokenPart[2];
    var startPosition = position - tokenPart.length;
    textTo = text.substr(0, startPosition);
    var textFrom = text.substr(startPosition);
    tokenPartRegex = /^(\w*)(\b|\w*|$)?/;
    tokenPart = tokenPartRegex.exec(textFrom);
    if (!tokenPart) {
      debugger;
    }
    tokenPart = tokenPart[1];
    textFrom = textFrom.substr(tokenPart.length);
    text = textTo + word + textFrom;
    pash.getTextArea().value = text;
    pash.updateText();
    this.hideList();
    //getline text
    //insert the word, possibly replacing current token
    //set line text.
  },
  textChanged: function(source, event, data){
    if (this.isListShown()) {
      this.checkFilterList(source, event, data);
    }
    else {
      this.checkPopupList(source, event, data);
    }
  },
  checkFilterList: function(source, event, data) {
    var text = data.text;
    var position = data.position;
    var from = text.substr(0, position);
    var lastTokenRegex = /(\b|\s*|^)?(\w*)$/;
    var lastTokenPrefix = lastTokenRegex.exec(from);
    if (!lastTokenPrefix) {
      debugger;
    }
    else {
      var tokenPart = lastTokenPrefix[2];
      if (tokenPart.length) {
        var to = text.substr(position - tokenPart.length);
        lastTokenRegex = /^(\w*)(\b|\s*|$)?/;
        lastTokenPrefix = lastTokenRegex.exec(to);
        if (!lastTokenPrefix) {
          debugger;
        }
        else {
          tokenPart = lastTokenPrefix[1];
        }
      }
      var displayed = this.filterList(tokenPart);
      if (displayed === 0) {
        this.hideList();
      }
    }
  },
  checkPopupList: function(source, event, data) {
    var pash = this.pash;
    var showList = false, words;
    var onCount = 0;
    var text = pash.replaceNbsp(data.text);
    var position = Math.min(data.position, text.length);
    var textTo = text.substr(0, position);
    if (position > text.length) {
      return;
    }
    var ch = text[position - 1];
    var nbsp = String.fromCharCode(160);
    switch (ch) {
      case "[":
      case ".":
      case " ":
      case nbsp:
        var token, tokenizer = pash.getTokenizer();
        var enteredText = pash.getEnteredStatementText();
        var statementText = enteredText + textTo;
        tokenizer.tokenize(statementText);
        var withClause = false, memberClause = false, setClause = false, asClause = false, selectClause = false, onClause = false, fromClause = false, whereClause = false;
        while (token = tokenizer.nextToken()) {
          switch (token.type) {
            case "identifier":
              if (onClause) {
                onClause = false;
              }
              switch (token.text.toUpperCase()) {
                case "WITH":
                  withClause = true;
                  break;
                case "MEMBER":
                  asClause = false;
                  memberClause = true;
                  setClause = false;
                  break;
                case "SET":
                  asClause = false;
                  memberClause = false;
                  setClause = true;
                  break;
                case "AS":
                  asClause = memberClause || setClause;
                  break;
                case "SELECT":
                  selectClause = true;
                  break;
                case "ON":
                  onClause = true;
                  onCount++;
                  break;
                case "FROM":
                  fromClause = true;
                  break;
                case "WHERE":
                  fromClause = true;
                  break;
              }
              break;
            case "operator":
              switch (token.text) {
                case ",":
                  if (onClause) {
                    onClause = false;
                  }
                  break;
              }
              break;
          }
        }
        switch (ch) {
          case "[":
            //this.handleIdentifierStart();
            break;
          case ".":
            //this.handleDot();
            break;
          case " ":
          case nbsp:
            if (onClause) {
              onCount--;
              words = [String(onCount), "Axis(" + onCount + ")"];
              var axisAlias = [
                "COLUMNS",
                "ROWS",
                "PAGES",
                "SECTIONS",
                "CHAPTERS"
              ];
              if (onCount < axisAlias.length) {
                words.push(axisAlias[onCount]);
              }
            }
            break;
        }
    }
    if (words && words.length){
      this.populateList(words);
      showList = true;
    }
    this.showList(showList);
  },
  caretPositionChanged: function(source, event, data){
    var style = this.listDom.style;
    style.left = (data.offsetLeft + 10) + "px";
    style.top = (data.parentNode.offsetTop - 90) + "px";
  },
  clearList: function(){
    this.listDom.innerHTML = "";
  },
  filterList: function(prefix) {
    var matchPrefix = prefix.toUpperCase();
    var listDom = this.listDom, items = listDom.childNodes, i, n = items.length, item, word, display, highlighted = false;
    var displayed = 0;
    for (i = 0; i < n; i++){
      item = items[i];
      word = item.innerHTML;
      if (word.toUpperCase().indexOf(matchPrefix) === 0) {
        display = "";
        displayed++;
        if (!highlighted) {
          item.className = "selected";
          highlighted = true;
        }
      }
      else {
        item.className = "";
        display = "none";
      }
      item.style.display = display;
    }
    return displayed;
  },
  populateList: function(words){
    this.clearList();
    var listDom = this.listDom, i, n = words.length, word, item;
    for (i = 0; i < n; i++) {
      word = words[i];
      item = document.createElement("DIV");
      if (i === 0) {
        item.className = "selected";
      }
      item.innerHTML = word;
      listDom.appendChild(item);
    }
  },
  showList: function(showOrHide){
    this.listDom.style.display = showOrHide ? "block" : "none";
  },
  hideList: function(){
    this.showList(false);
  },
  isListShown: function(){
    return this.listDom.style.display === "block";
  },
  createDom: function(){
    var el = document.createElement("DIV");
    this.listDom = el;
    el.className = "pash-autocomplete-list";
    this.pash.getDom().appendChild(el);
    //this.caretPositionChanged(this.pash, "caretPositionChanged", this.pash.getCaret());
    this.populateList(this.commandList);
  },
};

exports.PashAutoComplete = PashAutoComplete;
})(typeof(exports) === "object" ? exports : window);
