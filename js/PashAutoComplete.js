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
  getSelectedWord: function(){
    var item = this.getSelectedListItem();
    if (!item) {
      return null;
    }
    return item.firstChild.textContent;
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
      if (node.style.display === "none") {
        return;
      }
      if (node.className === "selected") {
        var j, n, item = prevItem = node, prop;
        if (nextOrPrevious < 0) {
          n = -nextOrPrevious;
          prop = "previousSibling";
        }
        else {
          n = nextOrPrevious;
          prop = "nextSibling";
        }
        outer: for (j = 0; j < n; j++) {
          inner: while (true) {
            item = item[prop];
            if (!item) {
              item = prevItem;
              break outer;
            }
            else
            if (item.style.display !== "none") {
              prevItem = item;
              break inner;
            }
          };
        }
        if (item) {
          node.className = "";
          item.className = "selected";
          var list = item.parentNode;
          if (item.offsetTop > list.clientHeight) {
            list.scrollTop = (item.offsetTop + item.offsetHeight) - list.offsetHeight;
          }
          else
          if (item.offsetTop < list.scrollTop) {
            list.scrollTop = item.offsetTop;
          }
        }
        return false;
      }
    }, this) === false) {
      ret = true;
    }
    else {
      ret = false;
    }
    return ret;
  },
  selectNext: function(num){
    if (typeof(num) === "undefined") {
      num = 1;
    }
    return this.selectNextOrPreviousItem(num);
  },
  selectPrevious: function(num){
    if (typeof(num) === "undefined") {
      num = 1;
    }
    return this.selectNextOrPreviousItem(-num);
  },
  keyDown: function(source, event, data){
    var pash = this.pash;
    var textArea = pash.getTextArea();
    var ret;
    if (this.isListShown()) {
      ret = false;
      var keyCode = data.keyCode;
      switch (keyCode) {
        case 8:
          this.hideList();
          ret = true;
          break;
        case 9:
        case 13:
          this.enterSelectedWord();
          break;
        case 33:  //page up
          this.selectPrevious(5);
          break;
        case 34:  //page down
          this.selectNext(5);
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
  getWordAtPosition: function(position){
    var pash = this.pash;
    var text = pash.replaceNbsp(pash.getLineTextString());
    position = Math.min(position, text.length);
    var textTo = text.substr(0, position);
    var tokenPartRegex = /(\b|\W*|^)?(\w*)$/;
    var tokenPart = tokenPartRegex.exec(textTo);
    if (!tokenPart){
      return null;
    }
    tokenPart = tokenPart[2];
    var startPosition = position - tokenPart.length;
    textTo = text.substr(0, startPosition);
    var textFrom = text.substr(startPosition);
    tokenPartRegex = /^(\w*)(\b|\W*|$)?/;
    tokenPart = tokenPartRegex.exec(textFrom);
    if (!tokenPart) {
      return null;
    }
    return {
      text: text,
      position: startPosition,
      word: tokenPart[1]
    };
  },
  enterSelectedWord: function(){
    var word = this.getSelectedWord();
    if (word === null) {
      this.hideList();
      return;
    }
    var pash = this.pash;
    var wordAtPosition = this.getWordAtPosition(pash.getCaretPosition());
    if (!wordAtPosition) {
      this.hideList();
      return;
    }
    var before = wordAtPosition.text.substr(0, wordAtPosition.position);
    var after = wordAtPosition.text.substr(wordAtPosition.position + wordAtPosition.word.length);
    var text = before + word + after;
    pash.setTextAreaText(text);
    pash.updateText();
    this.hideList();
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
    var pash = this.pash;
    var wordAtPosition = this.getWordAtPosition(pash.getCaretPosition());
    if (!wordAtPosition) {
      return;
    }

    var displayed = this.filterList(wordAtPosition.word);
    if (displayed === 0) {
      this.hideList();
    }
  },
  sortWords: function(word1, word2){
    word1 = word1.toUpperCase();
    word2 = word2.toUpperCase();
    var ret;
    if (word1 < word2) {
      ret = -1;
    }
    else
    if (word1 > word2) {
      ret = 1;
    }
    else {
      ret = 0;
    }
    return ret;
  },
  arrayToWords: function(array) {
    return array.concat([]);
  },
  mapToWords: function(map){
    var words = [], word;
    for (word in map) {
      words.push(word);
    }
    return words;
  },
  rowsetToWords: function(rowset, column) {
    var words = [];
    rowset.eachRow(function(row){
      words.push(row[column]);
    });
    return words;
  },
  checkPopupList: function(source, event, data) {
    var showList = false, words, prefix, onCount = 0;
    var pash = this.pash;
    var wordAtPosition = this.getWordAtPosition(pash.getCaretPosition());
    var textBefore = wordAtPosition.text.substr(0, wordAtPosition.position);

    var ch = wordAtPosition.text[data.position - 1];
    var nbsp = String.fromCharCode(160);
    var token, tokens = [], tokenizer = pash.getTokenizer();

    var enteredText = pash.getEnteredStatementText();
    var statementText = enteredText + textBefore + wordAtPosition.word;
    tokenizer.tokenize(statementText);
    var withClause = false, memberClause = false, setClause = false, asClause = false, selectClause = false, onClause = false, fromClause = false, whereClause = false;
    while (token = tokenizer.nextToken()) {
      tokens.push(token);
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
        else
        if (tokens.length === 1) {
          switch (tokens[0].text.toUpperCase()) {
            case "HELP":
              words = pash.commandList;
              break;
            case "SET":
              words = this.mapToWords(pash.setPropertyMap);
              break;
            case "SHOW":
              words = this.mapToWords(pash.showKeywordMethodMap);
              break;
            case "USE":
              pash.getCatalogs(function(xmla, request, rowset){
                var words = this.rowsetToWords(rowset, "CATALOG_NAME");
                this.populateList(words);
                this.showList();
              }, null, this);
              break;
          }
        }
        else
        if (tokens.length === 2 && tokens[0].text.toUpperCase() === "HELP" && tokens[1].text.toUpperCase() === "SHOW") {
          words = this.mapToWords(showKeywordMethodMap);
          break;
        }
        else
        if (tokens.length === 2 && tokens[0].text.toUpperCase() === "SET" && tokens[1].type === "identifier") {
          var prop = pash.getSetProperty(tokens[1].text);
          if (prop && prop.values) {
            words = this.mapToWords(prop.values);
          }
        }
        break;
      default:
        if (tokens.length === 1 && tokens[0].type === "identifier") {
          words = this.arrayToWords(pash.commandList);

          prefix = tokens[0].text.toUpperCase();
          if ("SELECT".indexOf(prefix) === 0) {
            words.push("SELECT");
          }
          else
          if ("WITH".indexOf(prefix) === 0) {
            words.push("WITH");
          }
        }
    }
    if (words && words.length){
      words.sort(this.sortWords);
      this.populateList(words);
      if (prefix){
        this.filterList(prefix);
      }
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
      word = item.firstChild.textContent;
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
    var listDom = this.listDom, i, n = words.length, word, item, span;
    for (i = 0; i < n; i++) {
      word = words[i];
      item = document.createElement("DIV");
      if (i === 0) {
        item.className = "selected";
      }
      span = document.createElement("SPAN");
      item.appendChild(span);
      span.innerHTML = this.pash.escapeHTML(word);
      listDom.appendChild(item);
    }
  },
  showList: function(showOrHide){
    showOrHide = showOrHide === false ? false : true;
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
  },
};

exports.PashAutoComplete = PashAutoComplete;
})(typeof(exports) === "object" ? exports : window);
