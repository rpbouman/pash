(function(exports) {

var PashAutoComplete = function(pash){
  this.pash = pash;
  var me = this;
  pash.setPropertyMap["AUTOCOMPLETE"] = {
    helpText: "Turn autocomplete on or off.",
    property: "autocomplete",
    expected: ["single quoted string", "double quoted string", "identifier"],
    setter: function(value){
      if (value === "true") {
        value = true;
      }
      else
      if (value === "false") {
        value = false;
      }
      me.enabled = value;
    },
    values: {
      ON: "true",
      OFF: "false"
    }
  };

  pash.addListener("textChanged", this.textChanged, this);
  pash.addListener("keydown", this.keyDown, this);
  pash.addListener("caretPositionChanged", this.caretPositionChanged, this);
  this.createDom();
};

var allMembersDotExpression = {
      type: "set",
      caption: "AllMembers"
    },
    captionDotExpression = {
      type: "string",
      caption: "Caption"
    },
    childrenDotExpression = {
      type: "set",
      caption: "Children"
    },
    countDotExpression = {
      type: "integer",
      caption: "Count"
    },
    currentDotExpression = {
      type: "member",
      caption: "Current"
    },
    currentMemberDotExpression = {
      type: "member",
      caption: "CurrentMember"
    },
    currentOrdinalDotExpression = {
      type: "integer",
      caption: "CurrentOrdinal"
    },
    defaultMemberDotExpression = {
      type: "member",
      caption: "DefaultMember"
    },
    dimensionDotExpression = {
      type: "dimension",
      caption: "Dimension"
    },
    firstChildDotExpression = {
      type: "member",
      caption: "FirstChild"
    },
    firstSiblingDotExpression = {
      type: "member",
      caption: "FirstSibling"
    },
    hierarchyDotExpression = {
      type: "hierarchy",
      caption: "Hierarchy"
    },
    itemDotExpression = {
      type: "member",
      caption: "Item"
    },
    lagDotExpression = {
      type: "member",
      caption: "Lag"
    },
    lastChildDotExpression = {
      type: "member",
      caption: "LastChild"
    },
    lastSiblingDotExpression = {
      type: "member",
      caption: "LastSibling"
    },
    leadDotExpression = {
      type: "member",
      caption: "Lead"
    },
    levelDotExpression = {
      type: "level",
      caption: "Level"
    },
    levelsDotExpression = {
      type: "level",
      caption: "Levels"
    },
    membersDotExpression = {
      type: "set",
      caption: "Members"
    },
    memberValueDotExpression = {
      type: "string",
      caption: "MemberValue"
    },
    nameDotExpression = {
      type: "string",
      caption: "Name"
    },
    nextMemberDotExpression = {
      type: "member",
      caption: "NextMember"
    },
    ordinalDotExpression = {
      type: "integer",
      caption: "Ordinal"
    },
    parentDotExpression = {
      type: "member",
      caption: "Parent"
    },
    prevMemberDotExpression = {
      type: "member",
      caption: "PrevMember"
    },
    propertiesDotExpression = {
      type: "string",
      caption: "Properties"
    },
    siblingsDotExpression = {
      type: "set",
      caption: "Siblings"
    },
    uniqueNameDotExpression = {
      type: "string",
      caption: "UniqueName"
    },
    unknownMemberDotExpression = {
      type: "member",
      caption: "UnknownMember"
    },
    valueDotExpression = {
      type: "string",
      caption: "Value"
    };

PashAutoComplete.prototype = {
  //if a dimension has maxDimensionCardinality or less members they are automatically available in the autocomplete menu without specifying a level.
  maxDimensionCardinality: 25,
  dimensionDotExpressions: {
    CAPTION: captionDotExpression,
    NAME: nameDotExpression,
    UNIQUENAME: uniqueNameDotExpression
  },
  hierarchyDotExpressions: {
    ALLMEMBERS: allMembersDotExpression,
    CAPTION: captionDotExpression,
    CURRENTMEMBER: currentMemberDotExpression,
    DEFAULTMEMBER: defaultMemberDotExpression,
    DIMENSION: dimensionDotExpression,
    LEVELS: levelsDotExpression,
    MEMBERS: membersDotExpression,
    NAME: nameDotExpression,
    UNIQUENAME: uniqueNameDotExpression,
    UNKNOWNMEMBER: unknownMemberDotExpression
  },
  levelDotExpressions: {
    ALLMEMBERS: allMembersDotExpression,
    DIMENSION: dimensionDotExpression,
    HIERARCHY: hierarchyDotExpression,
    MEMBERS: membersDotExpression,
    NAME: nameDotExpression,
    ORDINAL: ordinalDotExpression,
    UNIQUENAME: uniqueNameDotExpression
  },
  memberDotExpressions: {
    CAPTION: captionDotExpression,
    CHILDREN: childrenDotExpression,
    DIMENSION: dimensionDotExpression,
    FIRSTCHILD: firstChildDotExpression,
    FIRSTSIBLING: firstSiblingDotExpression,
    HIERARCHY: hierarchyDotExpression,
    LAG: lagDotExpression,
    LASTCHILD: lastChildDotExpression,
    LASTSIBLING: lastSiblingDotExpression,
    LEAD: leadDotExpression,
    LEVEL: levelDotExpression,
    MEMBERVALUE: memberValueDotExpression,
    NAME: nameDotExpression,
    NEXTMEMBER: nextMemberDotExpression,
    PARENT: parentDotExpression,
    PREVMEMBER: prevMemberDotExpression,
    PROPERTIES: propertiesDotExpression,
    SIBLINGS: siblingsDotExpression,
    UNIQUENAME: uniqueNameDotExpression,
    UNKNOWNMEMBER: unknownMemberDotExpression,
    VALUE: valueDotExpression
  },
  setDotExpressions: {
    COUNT: countDotExpression,
    CURRENT: currentDotExpression,
    CURRENTORDINAL: currentOrdinalDotExpression,
    ITEM: itemDotExpression
  },
  //https://msdn.microsoft.com/en-us/library/ms145573.aspx
  intrinsicCellProperties: [
    "ACTION_TYPE",
    "BACK_COLOR",
    "CELL_ORDINAL",
    "FONT_FLAGS",
    "FONT_NAME",
    "FONT_SIZE",
    "FORE_COLOR",
    "FORMAT",
    "FORMAT_STRING",
    "FORMATTED_VALUE",
    "LANGUAGE",
    "UPDATEABLE",
    "VALUE"
  ],
  getDotExpressionsMapForType: function(type) {
    var dotExpressionsMap;
    var name = type + "DotExpressions";
    var map = this[name];
    return map;
  },
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
    if (this.enabled === false) {
      return;
    }
    var me = this;
    var pash = this.pash;
    var textArea = pash.getTextArea();
    var ret;
    var keyCode = data.keyCode;
    if (this.isListShown()) {
      ret = false;
      switch (keyCode) {
        case 8:   //backspace
          ret = true;
        case 27:  //escape
        case 37:  //arrow left
          this.hideList();
          break;
          //tab, return, space and arrow right select and insert the selection.
        case 9:
          pash.focus();
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
    var text = pash.getLineTextString() || "";
    text = pash.replaceNbsp(text);
    if (typeof(position) === "undefined") {
      position = pash.getCaretPosition() - 1;
    }
    position = Math.min(position, text.length);
    var textTo = text.substr(0, position);
    var tokenPartRegex = /(\b|^|\[|\W)?(\w*|[,\{\}\(\)])$/;
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
    tokenPartRegex = /^([,\{\}\(\)]|\[?\w*)(\]|\b|$|\W)?/;
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
    if (this.enabled === false) {
      return;
    }
    var displayed = 0;
    if (this.isListShown()) {
      displayed = this.checkFilterList(source, event, data);
    }
    if (displayed === 0) {
      this.hideList();
    }
    if (!this.isListShown()) {
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
    if (wordAtPosition.word === "") {
      this.hideList();
      return 0;
    }
    return this.filterList(wordAtPosition.word);
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
    if (rowset instanceof Xmla.Rowset) {
      rowset = rowset.fetchAllAsObject();
    }

    if (!(rowset instanceof Array)) {
      throw "Not an array";
    }

    var words = [];
    var row, i, n = rowset.length;
    for (i = 0; i < n; i++) {
      row = rowset[i];
      word = row[column];
      word = this.brace(word);
      words.push(word);
    }
    return words;
  },
  rowsetToMap: function(rowset, column, map) {
    if (rowset instanceof Xmla.Rowset) {
      rowset = rowset.fetchAllAsObject();
    }
    if (!(rowset instanceof Array)) {
      throw "Not an array";
    }

    if (!map){
      map = {};
    }
    var row, i, n = rowset.length;
    for (i = 0; i < n; i++) {
      row = rowset[i];
      word = row[column];
      word = this.brace(word);
      map[word] = word;
    }
    return map;
  },
  popupCatalogsList: function(prefix){
    var pash = this.pash;
    pash.getCatalogs(function(xmla, request, rowset){
      var words = this.rowsetToWords(rowset, "CATALOG_NAME");
      this.populateList(words);
      if (prefix) {
        this.filterList(prefix);
      }
      this.showList(true);
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
        expect = ".";
        identifiers.unshift(token);
        continue;
      }
      else {
        break;
      }
    }
    return identifiers;
  },
  isBraced: function(string) {
    return string.charAt("0") === "[" && string.charAt(string.length - 1) === "]";
  },
  brace: function(string){
    if (!this.isBraced(string)){
      string = "[" + string + "]";
    }
    return string;
  },
  stripBraces: function(token) {
    var strip, type = typeof(token);
    switch (type) {
      case "object":
        if (token.type && token.text) {
          switch (token.type) {
            case "identifier":
              break;
            case "square braces":
              strip = true;
              break;
            default:
              throw "Invalid identifier";
          }
          token = token.text;
        }
        else {
          throw "Invalid identifier";
        }
        break;
      case "string":
        if (this.isBraced(token)) {
          strip = true;
        }
        break;
      default:
        throw "Invalid identifier";
    }
    if (strip){
      token = token.substr(1, token.length - 2);
    }
    return token;
  },
  mergeDotExpressionMaps: function() {
    var map = {}, arg, item, p, i, n = arguments.length;
    for (i = 0; i < n; i++){
      arg = arguments[i];
      for (p in arg){
        item = arg[p];
        map[item.caption] = item.caption;
      }
    }
    return map;
  },
  popupListForMap: function(map) {
    var words = this.mapToWords(map);
    if (words.length === 0) {
      return;
    }
    this.popupListForArray(words);
  },
  popupListForArray: function(words) {
    this.sortWords(words);
    this.populateList(words);
    this.showList(true);
  },
  popupRestrictionColumnsList: function(showMethodName){
    var pash = this.pash;
    pash.getHelpTextForShowMethod(showMethodName, function(text){
      var el = document.createElement("DIV");
      el.innerHTML = text;
      var table = el.firstChild;
      var rows = table.rows, i, n = rows.length, row, cells, cols = [];
      for (i = 1; i < n; i++) {
        row = rows[i];
        cells = row.cells;
        if (cells[3].innerHTML === "Yes") {
          cols.push(cells[0].innerHTML);
        }
      }
      this.popupListForArray(cols);
    }, this);
  },
  popupDimensionAndHierarchyDotExpressionList: function(restrictions, dimensionName){
    try {
      restrictions.DIMENSION_NAME = dimensionName;
      var isDimension, isHierarchy, args = [];
      var pash = this.pash;
      pash.getDimensions(function(rowset) {

        if (rowset.length !== 0){
          args.push(this.dimensionDotExpressions);
        }

        delete restrictions.DIMENSION_NAME;
        restrictions.HIERARCHY_NAME = dimensionName;
        pash.getHierarchies(function(rowset) {
          if (rowset.length !== 0){
            args.push(this.hierarchyDotExpressions);
          }
          this.popupListForMap(this.mergeDotExpressionMaps.apply(this, args));
        }, null, this, restrictions);
      }, null, this, restrictions);
    }
    catch (exception){
      //probably no catalog set.
      console.log("Exception in popupDimensionAndHierarchyDotExpressionList.");
      console.log(exception);
      console.log("Is your catalog set?");
    }
  },
  popupHierarchyAndLevelDotExpressionList: function(restrictions, identifier1, identifier2){
    try {
      var args = [];
      var pash = this.pash;      
      restrictions.DIMENSION_NAME = identifier1;
      //check if identifier1 is a dimension
      pash.getDimensions(function(dimensions) {
        delete restrictions.DIMENSION_NAME;
        var map = {};
        //check if identifier2 is a hierarchy
        restrictions.HIERARCHY_NAME = identifier2;
        this.getHierarchiesForDimensions(map, dimensions, 0, restrictions, function(){
          for (var p in map) {
            //yes to both, popup hierarchy dot expressions
            args.push(this.hierarchyDotExpressions);
            break;
          }

          //check if identifier1 is a hierarchy
          restrictions.HIERARCHY_NAME = identifier1;
          pash.getHierarchies(function(hierarchies){
            delete restrictions.HIERARCHY_NAME;
            var map = {};
            //check if identifier2 is a level
            restrictions.LEVEL_NAME = identifier2;
            this.getLevelsForHierarchies(map, hierarchies, 0, restrictions, function(){
              for (var p in map) {
                args.push(this.levelDotExpressions);
                break;
              }
              map = this.mergeDotExpressionMaps.apply(this, args);
              this.popupListForMap(map);
            }, this);

          }, null, this, restrictions);
        }, this);
      }, null, this, restrictions);
    }
    catch (exception) {
    }
  },
  popupDimensionsAndHierarchiesList: function(restrictions){
    try {
      var pash = this.pash;      
      pash.getDimensions(function(rowset) {
        var map = {};
        this.rowsetToMap(rowset, "DIMENSION_NAME", map);
        pash.getHierarchies(function(rowset) {
          map = this.rowsetToMap(rowset, "HIERARCHY_NAME", map);
          this.popupListForMap(map);
        }, null, this, restrictions);
      }, null, this, restrictions);
    }
    catch (exception){
      //probably no catalog set.
      console.log("Exception in popupDimensionsAndHierarchiesList.");
      console.log(exception);
      console.log("Is your catalog set?");
    }
  },
  copyArrayTo: function(source, target){
    var i, n = source.length;
    for (i = 0; i < n; i++) {
      target.push(source[i]);
    }
  },
  getHierarchiesForDimensions: function(map, dimensions, index, restrictions, callback, scope){
    var pash = this.pash;
    if (index >= dimensions.length) {
      callback.call(scope);
      return;
    }
    var dimension = dimensions[index++];
    restrictions.CUBE_NAME = dimension.CUBE_NAME;
    restrictions.DIMENSION_UNIQUE_NAME = dimension.DIMENSION_UNIQUE_NAME;
    pash.getHierarchies(function(hierarchies){
      if (map instanceof Array) {
        this.copyArrayTo(hierarchies, map);
      }
      else {
        this.rowsetToMap(hierarchies, "HIERARCHY_NAME", map);
      }
      delete restrictions.CUBE_NAME;
      delete restrictions.DIMENSION_UNIQUE_NAME;
      this.getHierarchiesForDimensions(map, dimensions, index, restrictions, callback, scope);
    }, null, this, restrictions);
  },
  getLevelsForHierarchies: function(map, hierarchies, index, restrictions, callback, scope){
    if (index >= hierarchies.length) {
      callback.call(scope);
      return;
    }
    var hierarchy = hierarchies[index++];
    var pash = this.pash;
    restrictions.CUBE_NAME = hierarchy.CUBE_NAME;
    restrictions.DIMENSION_UNIQUE_NAME = hierarchy.DIMENSION_UNIQUE_NAME;
    restrictions.HIERARCHY_UNIQUE_NAME = hierarchy.HIERARCHY_UNIQUE_NAME;
    pash.getLevels(function(levels){
      if (map instanceof Array) {
        this.copyArrayTo(levels, map);
      }
      else {
        this.rowsetToMap(levels, "LEVEL_NAME", map);
      }
      delete restrictions.CUBE_NAME;
      delete restrictions.DIMENSION_UNIQUE_NAME;
      delete restrictions.HIERARCHY_UNIQUE_NAME;
      this.getLevelsForHierarchies(map, hierarchies, index, restrictions, callback, scope);
    }, null, this, restrictions);
  },
  getMembersForLowCardinalityDimensions: function(map, dimensions, index, restrictions, callback, scope){
    var dimension;
    while (true) {
      if (index >= dimensions.length) {
        callback.call(scope);
        return;
      }
      dimension = dimensions[index++];
      if (dimension.DIMENSION_CARDINALITY <= this.maxDimensionCardinality) {
        break;
      }
    };
    var pash = this.pash;    
    restrictions.CUBE_NAME = dimension.CUBE_NAME;
    restrictions.DIMENSION_UNIQUE_NAME = dimension.DIMENSION_UNIQUE_NAME;
    pash.getMembers(function(members){
      this.rowsetToMap(members, "MEMBER_NAME", map);
      delete restrictions.CUBE_NAME;
      delete restrictions.DIMENSION_UNIQUE_NAME;
      this.getMembersForLowCardinalityDimensions(map, dimensions, index, restrictions, callback, scope);
    }, null, this, restrictions);
  },
  getMembersForLowCardinalityHierarchies: function(map, hierarchies, index, restrictions, callback, scope){
    var hierarchy;
    while (true) {
      if (index >= hierarchies.length) {
        callback.call(scope);
        return;
      }
      hierarchy = hierarchies[index++];
      if (hierarchy.HIERARCHY_CARDINALITY <= this.maxDimensionCardinality) {
        break;
      }
    };
    var pash = this.pash;    
    restrictions.CUBE_NAME = hierarchy.CUBE_NAME;
    restrictions.DIMENSION_UNIQUE_NAME = hierarchy.DIMENSION_UNIQUE_NAME;
    restrictions.HIERARCHY_UNIQUE_NAME = hierarchy.HIERARCHY_UNIQUE_NAME;
    pash.getMembers(function(members){
      this.rowsetToMap(members, "MEMBER_NAME", map);
      delete restrictions.CUBE_NAME;
      delete restrictions.DIMENSION_UNIQUE_NAME;
      delete restrictions.HIERARCHY_UNIQUE_NAME;
      this.getMembersForLowCardinalityHierarchies(map, hierarchies, index, restrictions, callback, scope);
    }, null, this, restrictions);
  },
  getMembersForLevels: function(map, levels, index, restrictions, callback, scope) {
    if (index >= levels.length) {
      callback.call(scope);
      return;
    }
    var level = levels[index++];
    var pash = this.pash;    
    restrictions.CUBE_NAME = level.CUBE_NAME;
    restrictions.DIMENSION_UNIQUE_NAME = level.DIMENSION_UNIQUE_NAME;
    restrictions.HIERARCHY_UNIQUE_NAME = level.HIERARCHY_UNIQUE_NAME;
    restrictions.LEVEL_UNIQUE_NAME = level.LEVEL_UNIQUE_NAME;
    pash.getMembers(function(members){
      if (map instanceof Array) {
        this.copyArrayTo(members, map);
      }
      else {
        this.rowsetToMap(members, "MEMBER_NAME", map);
      }
      delete restrictions.CUBE_NAME;
      delete restrictions.DIMENSION_UNIQUE_NAME;
      delete restrictions.HIERARCHY_UNIQUE_NAME;
      delete restrictions.LEVEL_UNIQUE_NAME;
      this.getMembersForLevels(map, levels, index, restrictions, callback, scope);
    }, null, this, restrictions);
  },
  popupHierarchiesAndLevelsList: function(restrictions, dimensionName){
    try {
      var map = {};
      var dimensions = [];
      var hierarchies = [];
      var pash = this.pash;

      //get all dimensions that could match our identifier
      restrictions.DIMENSION_NAME = dimensionName;
      pash.getDimensions(function(dimensions) {
        delete restrictions.DIMENSION_NAME;
        //get all hierarchies that could match our identifier
        restrictions.HIERARCHY_NAME = dimensionName;
        pash.getHierarchies(function(hierarchies) {
          //colllect all hierarchies that belong to the dimensions we found
          delete restrictions.HIERARCHY_NAME;
          this.getHierarchiesForDimensions(map, dimensions, 0, restrictions, function(){
            //colllect all levels that belong to the hierarchies we found
            this.getLevelsForHierarchies(map, hierarchies, 0, restrictions, function(){
              //collect all members that belong to the low cardinality dimensions we found
              this.getMembersForLowCardinalityDimensions(map, dimensions, 0, restrictions, function(){
                this.getMembersForLowCardinalityHierarchies(map, hierarchies, 0, restrictions, function(){
                  this.popupListForMap(map);
                }, this);
              }, this);
            }, this);
          }, this);
        }, null, this, restrictions);
      }, null, this, restrictions);
    }
    catch (exception){
      //probably no catalog set.
      console.log("Exception in popupHierarchiesAndLevelsList.");
      console.log(exception);
      console.log("Is your catalog set?");
    }
  },
  popupLevelsAndMembersList: function(restrictions, identifier1, identifier2){
    try {
      var map = {};
      var dimensions = [];
      var dimensionHierarchies = [];
      var hierarchies = [];
      var hierarchyLevels = [];
      var pash = this.pash;

      //get all dimensions that could match our identifier
      restrictions.DIMENSION_NAME = identifier1;
      pash.getDimensions(function(dimensions) {
        delete restrictions.DIMENSION_NAME;
        //get all hierarchies that could match our identifier
        restrictions.HIERARCHY_NAME = identifier1;
        pash.getHierarchies(function(hierarchies) {
          //colllect hierarchies named identifier2 that belong to the dimensions we found
          delete restrictions.HIERARCHY_NAME;
          restrictions.HIERARCHY_NAME = identifier2
          this.getHierarchiesForDimensions(dimensionHierarchies, dimensions, 0, restrictions, function(){
            //colllect levels named identifier2 that belong to the hierarchies we found
            delete restrictions.HIERARCHY_NAME;
            restrictions.LEVEL_NAME = identifier2;
            this.getLevelsForHierarchies(hierarchyLevels, hierarchies, 0, restrictions, function(){
              delete restrictions.LEVEL_NAME;
              //get the levels for the dimension hierarchies
              this.getLevelsForHierarchies(map, dimensionHierarchies, 0, restrictions, function(){
                //get the members for the hierarchy levels
                this.getMembersForLevels(map, hierarchyLevels, 0, restrictions, function(){
                  this.popupListForMap(map);
                }, this);
              }, this);
            }, this);
          }, this);
        }, null, this, restrictions);
      }, null, this, restrictions);
    }
    catch (exception){
      //probably no catalog set.
      console.log("Exception in popupLevelsAndMembersList.");
      console.log(exception);
      console.log("Is your catalog set?");
    }
  },
  popupDotExpressionListDotExpressionList: function(token) {
    if (token.type !== "identifier") {
      return false;
    }
    var arg, args = [], text = token.text.toUpperCase();

    var dimensionDotExpression = this.dimensionDotExpressions[text];
    if (dimensionDotExpression) {
      arg = this.getDotExpressionsMapForType(dimensionDotExpression.type);
      if (arg) {
        args.push(arg);
      }
    }
    var hierarchyDotExpression = this.hierarchyDotExpressions[text];
    if (hierarchyDotExpression) {
      arg = this.getDotExpressionsMapForType(hierarchyDotExpression.type);
      if (arg) {
        args.push(arg);
      }
    }
    var levelDotExpression = this.levelDotExpressions[text];
    if (levelDotExpression) {
      arg = this.getDotExpressionsMapForType(levelDotExpression.type);
      if (arg) {
        args.push(arg);
      }
    }
    var memberDotExpression = this.memberDotExpressions[text];
    if (memberDotExpression) {
      arg = this.getDotExpressionsMapForType(memberDotExpression.type);
      if (arg) {
        args.push(arg);
      }
    }
    var setDotExpression = this.setDotExpressions[text];
    if (setDotExpression) {
      arg = this.getDotExpressionsMapForType(setDotExpression.type);
      if (arg) {
        args.push(arg);
      }
    }

    var ret;
    if (args.length === 0) {
      ret = false;
    }
    else {
      var map = this.mergeDotExpressionMaps.apply(this, args);
      this.popupListForMap(map);
      ret = true;
    }
    return ret;
  },
  checkPopupList: function(source, event, data) {
    var showList = false, words, prefix, onCount = 0;
    var pash = this.pash;

    var wordAtPosition = this.getWordAtPosition(pash.getCaretPosition());
    var textBefore = wordAtPosition.text.substr(0, wordAtPosition.position);

    var token, tokens = [], tokenizer = pash.getTokenizer(), ch;
    if (data.position === 0 && wordAtPosition.word === "") {
      ch = "\n";
    }
    else {
      ch = wordAtPosition.text[data.position - 1];
    }

    var enteredText = pash.getEnteredStatementText();
    if (enteredText) {
      enteredText += "\n";
    }
    var statementText = enteredText + textBefore + wordAtPosition.word;

    var withClause = false,
        memberClause = false,
        setClause = false,
        asClause = false,
        selectClause = false,
        dimensionClause = false,
        propertiesClause = false,
        onClause = false,
        axisComma = false,
        fromClause = false,
        whereClause = false,
        cellClause = false
    ;

    tokenizer.tokenize(statementText);
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
            case "DIMENSION":
              dimensionClause = tokens.length;
              break;
            case "PROPERTIES":
              propertiesClause = tokens.length;
              break;
            case "ON":
              axisComma = false;
              onClause = tokens.length;
              onCount++;
              break;
            case "FROM":
              fromClause = tokens.length;
              break;
            case "WHERE":
              whereClause = tokens.length;
              break;
            case "CELL":
              cellClause = tokens.length;
          }
          break;
        case "operator":
          switch (token.text) {
            case ",":
              if (onClause && axisComma === false) {
                axisComma = tokens.length;
                onClause = false;
              }
              else {
                axisComma = false;
              }
              break;
          }
          break;
      }
      tokens.push(token);
    }

    var restrictions = {}, cubeName;
    if (fromClause) {
      if (fromClause + 1 < tokens.length) {
        token = tokens[fromClause + 1];
        cubeName = this.stripBraces(token);
        restrictions.CUBE_NAME = cubeName;
      }
    }

    switch (ch) {
      case "[":
        if (tokens.length === 1 && tokens[0].text.toUpperCase() === "USE") {
          var prefix, word = this.getWordAtPosition();
          if (word) {
            prefix = word.word;
          }
          this.popupCatalogsList(prefix);
          return;
        }
        else
        if (withClause !== false || selectClause !== false) {

          var identifiers = this.getIdentifierChain(tokens);
          if (fromClause) {
            if (whereClause === false && identifiers.length === 0) {
              try {
                pash.getCubes(function(cubes){
                  var words = this.rowsetToWords(cubes, "CUBE_NAME");
                  this.populateList(words);
                  this.showList(true);
                }, null, this);
                return;
              }
              catch (exception){
                //probably no catalog set.
                console.log("Exception in checkPopupList.");
                console.log(exception);
                console.log("Is your catalog set?");
              }
              break;
            }
          }
          switch (identifiers.length) {
            case 0: //0 leading identifiers.
              this.popupDimensionsAndHierarchiesList(restrictions);
              return;
            case 1: //1 leading identifier.
              var identifier1 = this.stripBraces(identifiers[0]);
              this.popupHierarchiesAndLevelsList(restrictions, identifier1);
              return;
            case 2: //2 leading identifiers
              //TODO:
              var identifier1 = this.stripBraces(identifiers[0]);
              var identifier2 = this.stripBraces(identifiers[1]);
              this.popupLevelsAndMembersList(restrictions, identifier1, identifier2);
              return;
            default:
              //TODO:
              //this.popupMembersList(restrictions, identifier1, identifier2);
          }
        }
        break;
      case ".":
        var identifiers = this.getIdentifierChain(tokens);
        switch (identifiers.length) {
          case 0:
            break;
          case 1:
            var dimensionName = this.stripBraces(identifiers[0]);
            this.popupDimensionAndHierarchyDotExpressionList(restrictions, dimensionName);
            return;
          case 2:
            if (this.popupDotExpressionListDotExpressionList(identifiers[identifiers.length -1])) {
              return;
            }
            var identifier1 = this.stripBraces(identifiers[0]);
            var identifier2 = this.stripBraces(identifiers[1]);
            this.popupHierarchyAndLevelDotExpressionList(
              restrictions,
              identifier1,
              identifier2
            );
            return;
          case 3:

          default:
            if (this.popupDotExpressionListDotExpressionList(identifiers[identifiers.length -1])) {
              return;
            }
        }
        break;
      case "\n":
      case " ":
      case String.fromCharCode(160):
        if (
          selectClause === tokens.length -1 ||
          axisComma === tokens.length - 1
        ) {
          words = ["NON EMPTY"];
        }
        else
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
        if (dimensionClause === tokens.length -1) {
          words = ["PROPERTIES"];
        }
        else
        if (onClause && fromClause === false) {
          words = ["FROM"];
        }
        else
        if (fromClause === tokens.length - 1) {
          try {
            pash.getCubes(function(rowset){
              var words = this.rowsetToWords(rowset, "CUBE_NAME");
              this.populateList(words);
              this.showList(true);
            }, null, this);
            return;
          }
          catch (exception) {
            //probably no catalog set.
            console.log("Exception in checkPopupList.");
            console.log(exception);
            console.log("Is your catalog set?");
          }
          break;
        }
        else
        if (fromClause === tokens.length -2 && whereClause === false){
          words = ["CELL", "WHERE"];
        }
        else
        if (cellClause === tokens.length - 1) {
          words = ["PROPERTIES"];
        }
        else if (cellClause && propertiesClause === cellClause + 1) {
          words = this.intrinsicCellProperties;
        }
        else {
          switch (tokens.length) {
            case 0:
              return;
            case 1:
              switch (tokens[0].text.toUpperCase()) {
                case "HELP":
                  words = pash.commandList;
                  break;
                case "SET":
                  words = this.mapToWords(pash.setPropertyMap);
                  break;
                case "SHOW":
                  try {
                    pash.throwIfCatalogNotSet();
                    words = this.mapToWords(pash.showKeywordMethodMap);
                  }
                  catch (e) {
                    words = ["CATALOGS", "FUNCTIONS"];
                  }
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
                case "SHOW":
                  var showMethod = pash.getShowMethodName(token1);
                  switch (showMethod) {
                    case "showCurrentCatalog":
                    case "discoverDBCatalogs":
                      break;
                    default:
                      words = ["WHERE"];
                  }
              }
              break;
            default:
              if (tokens[0].text.toUpperCase() === "SHOW"){
                var showMethod = pash.getShowMethodName(tokens[1]);
                switch (showMethod) {
                  case "showCurrentCatalog":
                  case "discoverDBCatalogs":
                    break;
                  default:
                    var i = 2, token;
                    while (true) {
                      token = tokens[i];
                      if (i === 2) {
                        if (token.text !== "WHERE") {
                          //syntax error. nothing to show.
                          return;
                        }
                      }
                      else {
                        if (token.text !== "AND") {
                          //syntax error. nothing to show.
                          return;
                        }
                      }

                      i++;
                      if (i >= tokens.length) {
                        //popup a list with available restriction columns
                        this.popupRestrictionColumnsList(showMethod);
                        return;
                      }

                      token = tokens[i];
                      //check if this token is a valid restriction column
                      i++;
                      if (i >= tokens.length) {
                        //popup a list with only an = operator
                        words = ["="];
                        break;
                      }

                      token = tokens[i];
                      if (token.text !== "=") {
                        break;
                      }
                      i++;
                      if (i >= tokens.length) {
                        //popup a list with valid values for the column
                        words = ["''"];
                        break;
                      }

                      token = tokens[i];
                      switch (token.type) {
                        case "double quoted string":
                        case "single quoted string":
                          break;
                        default:
                          return;
                      }

                      i++;
                      if (i >= tokens.length) {
                        words = ["AND"];
                        break;
                      }
                    }
                }
              }
          }
        }
        break;
      case ",":
      case "{":
      case "}":
      case "(":
      case ")":
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
    if (this.enabled === false) {
      return;
    }
    var style = this.listDom.style;
    style.left = (data.offsetLeft + 15) + "px";
    var line = data.parentNode;
    var pash = this.pash;
    var pashDom = pash.getDom();
    var myDom = this.listDom;
    style.top = (line.offsetTop - 95) - (pashDom.scrollTop) + "px";
  },
  clearList: function(){
    this.listDom.innerHTML = "";
  },
  filterList: function(prefix) {
    var matchPrefix = prefix.toUpperCase();
    var listDom = this.listDom, items = listDom.childNodes, i, n = items.length,
        item, word,
        display, dislayed = 0, highlighted = false, firstDisplayedItem
    ;
    var displayed = 0;
    for (i = 0; i < n; i++){
      item = items[i];
      word = item.firstChild.textContent;
      if (word.toUpperCase().indexOf(matchPrefix) === 0) {
        display = "";
        displayed++;
        if (item.className === "selected") {
          highlighted = true;
        }
        if (!firstDisplayedItem) {
          firstDisplayedItem = item;
        }
      }
      else {
        item.className = "";
        display = "none";
      }
      item.style.display = display;
    }
    if (firstDisplayedItem && !highlighted) {
      firstDisplayedItem.className = "selected";
    }
    return displayed;
  },
  populateList: function(words){
    this.clearList();
    var listDom = this.listDom, i, n = words.length, word, item, span;
    var pash = this.pash;
    for (i = 0; i < n; i++) {
      word = words[i];
      item = document.createElement("DIV");
      if (i === 0) {
        item.className = "selected";
      }
      span = document.createElement("SPAN");
      item.appendChild(span);
      span.innerHTML = pash.escapeHTML(word);
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
