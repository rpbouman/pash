(function(exports) {

var PashAutoComplete = function(pash){
  this.pash = pash;
  pash.addListener("textChanged", this.textChanged, this);
  pash.addListener("keydown", this.keyDown, this);
  pash.addListener("caretPositionChanged", this.caretPositionChanged, this);
  this.createDom();
};

PashAutoComplete.prototype = {
  dimensionDotExpressions: [
    "Caption",
    "Members",
    "Name",
    "UniqueName"
  ],
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
          pash.restoreCaretPosition();
          break;
        case 34:  //page down
          this.selectNext(5);
          pash.restoreCaretPosition();
          break;
        case 38:  //up arrow
          this.selectPrevious();
          pash.restoreCaretPosition();
          break;
        case 40:  //down arrow
          this.selectNext();
          pash.restoreCaretPosition();
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
    if (typeof(position) === "undefined") {
      position = pash.getCaretPosition() - 1;
    }
    position = Math.min(position, text.length);
    var textTo = text.substr(0, position);
    var tokenPartRegex = /(\b|^|\[|\W)?(\w*)$/;
    var tokenPart = tokenPartRegex.exec(textTo);
    if (!tokenPart){
      return null;
    }
    var startPosition = position - tokenPart[2].length;
    if (tokenPart[1] === "[") {
      startPosition--;
    }
    textTo = text.substr(0, startPosition);
    var textFrom = text.substr(startPosition);
    tokenPartRegex = /^(\[?\w*)(\]|\b|$|\W)?/;
    tokenPart = tokenPartRegex.exec(textFrom);
    if (!tokenPart) {
      return null;
    }
    word = tokenPart[1];
    return {
      text: text,
      position: startPosition,
      word: word
    };
  },
  enterSelectedWord: function(){
    var word = this.getSelectedWord();
    if (word === null) {
      this.hideList();
      return;
    }
    var pash = this.pash;
    var position = pash.getCaretPosition() - 1;
    var wordAtPosition = this.getWordAtPosition(position);
    if (!wordAtPosition) {
      this.hideList();
      return;
    }
    var before = wordAtPosition.text.substr(0, wordAtPosition.position);
    var after = wordAtPosition.text.substr(wordAtPosition.position + wordAtPosition.word.length);
    var text = before + word + after;
    pash.setTextAreaText(text);
    pash.updateText();
    pash.setCaretPosition(wordAtPosition.position + word.length);
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
    var position = pash.getCaretPosition();
    var wordAtPosition = this.getWordAtPosition(position);
    if (!wordAtPosition) {
      return;
    }

    var displayed = this.filterList(wordAtPosition.word);
    if (displayed === 0) {
      this.hideList();
    }
  },
  wordSorter: function(word1, word2){
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
  sortWords: function(words){
    return words.sort(this.wordSorter);
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
      word = row[column];
      if (word.charAt("0") !== "[" && word.charAt(word.length - 1) !== "]") {
        word = "[" + row[column] + "]";
      }
      words.push(word);
    });
    return words;
  },
  rowsetToMap: function(rowset, column, map) {
    if (!map){
      map = {};
    }
    rowset.eachRow(function(row){
      word = row[column];
      if (word.charAt("0") !== "[" && word.charAt(word.length - 1) !== "]") {
        word = "[" + row[column] + "]";
      }
      map[word] = word;
    });
    return map;
  },
  popupCatalogsList: function(prefix){
    pash.getCatalogs(function(xmla, request, rowset){
      var words = this.rowsetToWords(rowset, "CATALOG_NAME");
      this.populateList(words);
      if (prefix) {
        this.filterList(prefix);
      }
      this.showList();
    }, null, this);
  },
  getIdentifierChain: function(tokens){
    var i, token, expect = ".", identifiers = [];
    for (i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];
      if (expect === "." && token.type === "operator" && token.text === ".") {
        expect = "identifier";
        continue;
      }
      else
      if (expect === "identifier" && (token.type === "identifier" || token.type === "square braces")) {
        expect = "dot";
        identifiers.unshift(token);
        continue;
      }
      else {
        break;
      }
    }
    return identifiers;
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
    var withClause = false,
        memberClause = false,
        setClause = false,
        asClause = false,
        selectClause = false,
        onClause = false,
        fromClause = false,
        whereClause = false
    ;
    while (token = tokenizer.nextToken()) {
      switch (token.type) {
        case "identifier":
          switch (token.text.toUpperCase()) {
            case "WITH":
              withClause = tokens.length;
              break;
            case "MEMBER":
              asClause = false;
              memberClause = tokens.length;
              setClause = false;
              break;
            case "SET":
              asClause = false;
              memberClause = tokens.length;
              setClause = true;
              break;
            case "AS":
              asClause = memberClause || setClause;
              break;
            case "SELECT":
              selectClause = tokens.length;
              break;
            case "ON":
              onClause = tokens.length;
              onCount++;
              break;
            case "FROM":
              fromClause = tokens.length;
              break;
            case "WHERE":
              whereClause = tokens.length;
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
      tokens.push(token);
    }
    switch (ch) {
      case "[":
        if (tokens.length === 1 && tokens[0].text.toUpperCase() === "USE") {
          var prefix, word = this.getWordAtPosition();
          if (word) {
            prefix = word.word;
          }
          this.popupCatalogsList(prefix);
        }
        else
        if (withClause !== false || selectClause !== false) {

          var identifiers = this.getIdentifierChain(tokens);
          if (fromClause) {
            if (whereClause === false && identifiers.length === 0) {
              try {
                pash.getCubes(function(xmla, request, rowset){
                  var words = this.rowsetToWords(rowset, "CUBE_NAME");
                  this.populateList(words);
                  this.showList();
                }, null, this);
              }
              catch (exception){
                //probably no catalog set.
              }
              break;
            }
            var cubeName;
            if (fromClause + 1 < tokens.length) {
              token = tokens[fromClause + 1];
              switch (token.type) {
                case "identifier":
                  cubeName = token.text;
                  break;
                case "square braces":
                  cubeName = token.text.substr(1, token.text.length - 2);
                  break;
              }
            }
          }

          switch (identifiers.length) {
            case 0: //0 leading identifiers.
              //next identifier should be either a hierarchy or a dimension,
              //so populate the list with hierarchy and dimension identifiers (deduplicate).
              try {
                pash.getDimensions(function(xmla, request, rowset) {
                  var map = this.rowsetToMap(rowset, "DIMENSION_NAME");
                  pash.getHierarchies(function(xmla, request, rowset) {
                    map = this.rowsetToMap(rowset, "HIERARCHY_NAME", map);
                    var words = this.mapToWords(map);
                    this.sortWords(words);
                    this.populateList(words);
                    this.showList();
                  }, null, this, cubeName);
                }, null, this, cubeName);
              }
              catch (exception){
                //probably no catalog set.
              }
              break;
            case 1: //1 leading identifier.
              //leading identifier might be a hierarchy or a dimension.
              //check if we can find out which one it is.
              //
              //if we know for sure it is a dimension check its hierarchies:
              //  - if there is one hierarchy and its name is identical to the dimension name
              //    - add its levels to the list
              //    - add its default member to the list, highlight it.
              //  - if there is one hierarchy and its name is not identical to the dimension name, populate the list with that hierarchy and highlight it
              //  - if there are multiple hierarchies  populate this list with hierarchies and highlight the DEFAULT_HIERARCHY
              //
              //if the DIMENSION_CARDINALITY is low, add members to the list
              //if we add members, then see if the dimension is unique.
              //  - if unique, use member names
              //  - if not unique, use member keys (with & notation)
              break;
            case 2: //2 leading identifiers
              //identifier 1 might be a dimension or a hierarchy. figure out which on it is.
              break;
          }
        }
        break;
      case ".":
        var identifiers = this.getIdentifierChain(tokens);
        if (identifiers.length === 1) {
          words = this.dimensionDotExpressions;
        }
        break;
      case " ":
      case nbsp:
        if (withClause !== false && selectClause === false && memberClause === false && setClause === false) {
          words = ["MEMBER", "SET"];
        }
        else
        if (onClause === tokens.length -1) {
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
        if (onClause && fromClause === false) {
          words = ["FROM"];
        }
        else
        if (fromClause === tokens.length - 1) {
          try {
            pash.getCubes(function(xmla, request, rowset){
              var words = this.rowsetToWords(rowset, "CUBE_NAME");
              this.populateList(words);
              this.showList();
            }, null, this);
          }
          catch (exception) {
            //probably no catalog set
          }
          break;
        }
        else
        if (fromClause === tokens.length -2 && whereClause === false){
          words = ["WHERE"];
        }
        else {
          switch (tokens.length) {
            case 1:
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
                  this.popupCatalogsList();
                  break;
              }
              break;
            case 2:
              var token1 = tokens[1];
              switch (tokens[0].text.toUpperCase()) {
                case "HELP":
                  switch (token1.text.toUpperCase()) {
                    case "SET":
                      words = this.mapToWords(pash.setPropertyMap);
                      break;
                    case "SHOW":
                      words = this.mapToWords(pash.showKeywordMethodMap);
                      break;
                  }
                  break;
                case "SET":
                  if (token1.type === "identifier") {
                    var prop = pash.getSetProperty(tokens[1].text);
                    if (prop && prop.values) {
                      words = this.mapToWords(prop.values);
                    }
                  }
                  break;
              }
              break;
          }
        }
        break;
      default:
        if ((tokens.length === 1 || tokens.length === 2) && (tokens[0].text.toUpperCase() === "USE")) {
          var prefix, word = this.getWordAtPosition();
          if (word) {
            prefix = word.word;
          }
          this.popupCatalogsList(prefix);
        }
        else
        if (tokens.length === 1 && tokens[0].type === "identifier") {
          words = this.arrayToWords(pash.commandList);
          prefix = tokens[0].text.toUpperCase();
          try {
            pash.throwIfCatalogNotSet();
            words.push("SELECT");
            words.push("WITH");
          }
          catch (exception) {
          }
        }
    }
    if (words && words.length){
      this.sortWords(words);
      this.populateList(words);
      showList = true;
      if (prefix){
        var display = this.filterList(prefix);
        if (display === 0) {
          showList = false;
        }
      }
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
    document.body.insertBefore(el, this.pash.getDom());
  },
};

exports.PashAutoComplete = PashAutoComplete;
})(typeof(exports) === "object" ? exports : window);
