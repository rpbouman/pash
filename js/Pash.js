(function(exports) {

function escXml(str) {
  if (str === null) {
    return null;
  }
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

var Xmlash = function(conf){
  Wsh.apply(this, arguments);
  this.lineNumber = 1;
  this.tokenizer = new exports.PashTokenizer();
  this.prompt = "";
  this.statementLines = [];
  this.xmlaRequest = {
    //forceResponseXMLEmulation: true,
    async: true,
    properties: {
    },
    restrictions: {
    }
  };
  this.xmla = new Xmla(this.xmlaRequest);
  this.xmla.addListener([
    {
      events: Xmla.EVENT_REQUEST,
      handler: function(){
        this.blockInput(true);
      },
      scope: this
    },
    {
      events: Xmla.EVENT_SUCCESS,
      handler: function(){
        this.blockInput(false);
      },
      scope: this
    },
    {
      events: Xmla.EVENT_ERROR,
      handler: function(xmla, request, exception){
        var exception = request.exception, code, desc;
        code = exception.code;
        desc = exception.message;
        if (
          request.method === Xmla.METHOD_DISCOVER &&
          request.requestType === Xmla.DISCOVER_DATASOURCES
        ) {
          console.log("Error discovering datasource: " + escXml(code) + ": " + escXml(desc));
        }
        else {
          this.error(desc + " (" + code + ")");
          try { //try to extract code and desc, these are passed by mondrian and often contain the actual information.
            var xml = request.xhr.responseXML;
            var code = xml.getElementsByTagName("code")[0].firstChild.data;
            var desc = xml.getElementsByTagName("desc")[0].firstChild.data;
            this.error(escXml(desc) + " (" + escXml(code) + ")");
          }
          catch (e) {
            //no extra info
          }
        }
        this.blockInput(false);
      },
      scope: this
    }
  ]);
  this.lines = [
    "MDX shell version " + this.version + " powered by Xmla4js.",
    "Copyright 2014, 2015 Roland Bouman.",
    "This program is open source."
  ];
  this.addListener("leaveLine", this.leaveLineHandler, this);
  this.render();
  this.initDatasources();
  this.schemaCache = {};
};

xmlashPrototype = {
  commandList: [
    "HELP",
    "SHOW",
    "SET",
    "USE"
  ],
  version: "Edge - Development",
  defaultPrompt: "MDX> ",
  memberPropertyToRender: "Caption",
  cellPropertyToRender: "FmtValue",
  getTokenizer: function() {
    return this.tokenizer;
  },
  getContinuationPrompt: function() {
    var prompt = String(this.lineNumber) + " ";
    var defaultPrompt = this.defaultPrompt;
    var i, n = defaultPrompt.length - prompt.length;
    for (i = 0; i < n; i++){
      prompt = " " + prompt;
    }
    return prompt;
  },
  leaveLineHandler: function(){
    var text = this.getLineText().textContent;
    var tokenizer = this.tokenizer, token,
        terminator = false, afterTerminator = false,
        prompt
    ;
    tokenizer.tokenize(text);
    while (token = tokenizer.nextToken()) {
      if (terminator) {
        afterTerminator = true;
      }
      if (token.type === "terminator") {
        terminator = true;
      }
    }
    this.statementLines.push(text);
    if (terminator) {
      this.lineNumber = 1;
      this.prompt = this.defaultPrompt;
      if (afterTerminator) {
        this.fireEvent("error");
        this.error("Tokens found after statement terminator.");
      }
      else {
        this.handleCommand();
      }
    }
    else {
      this.lineNumber++;
      this.prompt = this.getContinuationPrompt();
    }
  },
  getFullStatementText: function(){
    return this.getEnteredStatementText() + "\n" + this.getTextAreaText();
  },
  getEnteredStatementText: function(){
    return this.statementLines.join("\n");
  },
  handleCommand: function(){
    this.blockInput(true);
    var statement = this.getEnteredStatementText();
    statement = statement.substr(0, statement.lastIndexOf(";"));
    var tree = this.parse(statement);
    this.tokenizer.reset();
    this.setTextAreaText("");
    this.oldValue = "";
    this.statementLines.length = 0;
    this.fireEvent("commandHandled");
    this.blockInput(false);
  },
  showExpectedError: function(expected, found, append){
    if (append !== false) {
      append = true;
    }
    if (found.type && found.text) {
      found = found.type + " \"" + found.text + "\"";
    }
    this.error("Expected " + expected + ". Found: " + found + ".", append);
  },
  handleUse: function(){
    var me = this, tokenizer = this.tokenizer, token;
    if (tokenizer.hasMoreTokens()) {
      token = tokenizer.nextToken(), tokenType = token.type;
      if (  token &&
          ( tokenType === "double quoted string" ||
            tokenType === "single quoted string" ||
            tokenType === "square braces"
          )
      ) {
        tokenType = token.type = "identifier";
        token.text = token.text.substr(1, token.text.length - 2);
      }
    }
    if (!token || token.type !== "identifier") {
      this.showExpectedError("a catalog name", token ? token : "end of statement");
      return;
    }
    var xmlaRequest = this.xmlaRequest, request = {
      restrictions: {},
      properties: {
        DataSourceInfo: xmlaRequest.DataSourceInfo
      }
    };
    var oldCatalog = this.getCurrentCatalog();
    request.restrictions.CATALOG_NAME = request.properties.Catalog = token.text;
    var me = this;
    request.success = function(xmla, request, rowset){
      var i = 0, catalog;
      rowset.eachRow(function(row){
        if (i){
          throw "Unexpected error setting catalog (multiple catalogs found)";
        }
        catalog = row;
        i++;
        this.schemaCache = {};
      }, me);
      if (i === 1) {
        me.currentCatalog = catalog.CATALOG_NAME;
        me.showCurrentCatalog();
        me.prompt = me.defaultPrompt;
      }
      else {
        var msg;
        if (i === 0) {
          msg = "No such catalog";
        }
        else {
          msg = "Unexpected error setting catalog";
        }
        me.error(msg + " \"" + token.text + "\".");
        request.error(xmla, request);
      }
    }
    request.error = function(){
      delete request.properties.Catalog;
      delete request.restrictions.CATALOG_NAME;
      var c1 = token.text.toUpperCase();
      me.getCatalogs(
        function(xmla, request, rowset){
          var message = "", num = 0;
          rowset.eachRow(function(row){
            var c2 = row.CATALOG_NAME.toUpperCase();
            if (exports.levenstein(c1, c2) < 5) {
              if (message.length) {
                message += ", "
              }
              message += "\"" + row.CATALOG_NAME + "\"";
              num++;
            }
          });
          if (num) {
            me.writeResult(
              "Perhaps you meant"  +
              (num > 1 ? " one of" : "") +
              ": " + message + "?"
            );
          }
          me.currentCatalog = oldCatalog;
        },
        null,
        me
      );
    }
    me.xmla.discoverDBCatalogs(request);
  },
  throwIfCatalogNotSet: function(){
    var catalog = this.getCurrentCatalog();
    if (!catalog) {
      throw {
        message: "Catalog not set"
      };
    }
  },
  testFilter: function(row, restrictions){
    var column, field, value;
    for (column in restrictions) {
      field = row[column];
      if (typeof(field) === "undefined") {
        throw "No such field " + column;
      }
      if (restrictions[column] !== field) {
        return false;
      }
    }
    return true;
  },
  filter: function(rowset, restrictions){
    if (!restrictions) {
      //return a copy, the original array is our cache.
      //can't allow the caller writing to that.
      return [].concat(rowset);
    }
    var filteredRowset = [], i, row, n = rowset.length;
    for (i = 0; i < n; i++) {
      row = rowset[i];
      if (this.testFilter(row, restrictions)){
        filteredRowset.push(row);
      }
    }
    return filteredRowset;
  },
  getCubes: function(success, error, scope, filter) {
    this.throwIfCatalogNotSet();
    var cubes = this.schemaCache.cubes;
    if (cubes) {
      cubes = this.filter(cubes, filter)
      success.call(scope, cubes);
    }
    else {
      var catalog = this.getCurrentCatalog();
      var request = {
        restrictions: {
          CATALOG_NAME: catalog
        },
        properties: {
          Catalog: catalog
        }
      };
      var me = this;
      request.success = function(xmla, request, rowset) {
        me.schemaCache.cubes = rowset.fetchAllAsObject();
        if (success) {
          me.getCubes(success, error, scope, filter);
        }
      };
      request.error = function(xmla, request, rowset) {
        if (error) {
          error.call(scope, xmla, request, exception);
        }
      };
      this.xmla.discoverMDCubes(request);
    }
  },
  getDimensions: function(success, error, scope, filter) {
    this.throwIfCatalogNotSet();
    var dimensions = this.schemaCache.dimensions;
    if (dimensions) {
      dimensions = this.filter(dimensions, filter);
      success.call(scope, dimensions);
    }
    else {
      var catalog = this.getCurrentCatalog();
      var request = {
        restrictions: {
          CATALOG_NAME: catalog
        },
        properties: {
          Catalog: catalog
        }
      };
      var me = this;
      request.success = function(xmla, request, rowset) {
        var dimensions = [];
        rowset.eachRow(function(dimension){
          //only store dimensions that belong to a cube.
          if (
            dimension.CUBE_NAME &&
            dimension.DIMENSION_IS_VISIBLE === true
          ) {
            dimensions.push(dimension);
          }
        });
        me.schemaCache.dimensions = dimensions;
        if (success) {
          me.getDimensions(success, error, scope, filter);
        }
      };
      request.error = function(xmla, request, rowset) {
        if (error) {
          error.call(scope, xmla, request, exception);
        }
      };
      this.xmla.discoverMDDimensions(request);
    }
  },
  getHierarchies: function(success, error, scope, filter) {
    this.throwIfCatalogNotSet();
    var hierarchies = this.schemaCache.hierarchies;
    if (hierarchies) {
      hierarchies = this.filter(hierarchies, filter);
      success.call(scope, hierarchies);
    }
    else {
      var catalog = this.getCurrentCatalog();
      var request = {
        restrictions: {
          CATALOG_NAME: catalog
        },
        properties: {
          Catalog: catalog
        }
      };
      var me = this;
      request.success = function(xmla, request, rowset) {
        var hierarchies = [];
        rowset.eachRow(function(hierarchy){
          if (
            hierarchy.CUBE_NAME &&
            hierarchy.DIMENSION_IS_VISIBLE === true &&
            hierarchy.HIERARCHY_IS_VISIBLE === true
          ) {
            hierarchies.push(hierarchy);
          }
        });
        me.schemaCache.hierarchies = hierarchies;
        if (success) {
          me.getHierarchies(success, error, scope, filter);
        }
      };
      request.error = function(xmla, request, rowset) {
        if (error) {
          error.call(scope, xmla, request, exception);
        }
      };
      this.xmla.discoverMDHierarchies(request);
    }
  },
  getLevels: function(success, error, scope, filter) {
    this.throwIfCatalogNotSet();
    var levels = this.schemaCache.levels;
    if (levels) {
      levels = this.filter(levels, filter);
      success.call(scope, levels);
    }
    else {
      var catalog = this.getCurrentCatalog();
      var request = {
        restrictions: {
          CATALOG_NAME: catalog
        },
        properties: {
          Catalog: catalog
        }
      };
      var me = this;
      request.success = function(xmla, request, rowset) {
        var levels = [];
        rowset.eachRow(function(level){
          if (
            level.CUBE_NAME &&
            level.LEVEL_IS_VISIBLE === true
          ) {
            levels.push(level);
          }
        });
        me.schemaCache.levels = levels;
        if (success) {
          me.getLevels(success, error, scope, filter);
        }
      };
      request.error = function(xmla, request, rowset) {
        if (error) {
          error.call(scope, xmla, request, exception);
        }
      };
      this.xmla.discoverMDLevels(request);
    }
  },
  getMembers: function(success, error, scope, filter) {
    this.throwIfCatalogNotSet();
    var schemaCache = this.schemaCache;
    var _members, members = this.schemaCache.members;
    if (!members) {
      schemaCache.members = members = {};
    }
    var key = "", filterProp, filterValue, restrictions = {};
    for (filterProp in filter) {
      if (key !== "") {
        key += ";"
      }
      filterValue = filter[filterProp];
      key += filterProp + "=" + filterValue;
      restrictions[filterProp] = filterValue;
    }
    _members = members[key];
    if (_members) {
      success.call(scope, _members);
    }
    else {
      var catalog = this.getCurrentCatalog();
      restrictions.CATALOG_NAME = catalog;
      var request = {
        restrictions: restrictions,
        properties: {
          Catalog: catalog
        }
      };
      var me = this;
      request.success = function(xmla, request, rowset) {
        var members = [];
        rowset.eachRow(function(member){
          if (member.CUBE_NAME) {
            members.push(member);
          }
        });
        me.schemaCache.members[key] = members;
        if (success) {
          me.getMembers(success, error, scope, filter);
        }
      };
      request.error = function(xmla, request, rowset) {
        if (error) {
          error.call(scope, xmla, request, exception);
        }
      };
      this.xmla.discoverMDMembers(request);
    }
  },
  getCatalogs: function(success, error, scope){
    var oldCatalog = this.getCurrentCatalog();

    var xmlaRequest = this.xmlaRequest, request = {
      url: xmlaRequest.url,
      restrictions: {},
      properties: {
        DataSourceInfo: xmlaRequest.properties.DataSourceInfo
      },
      success: function(xmla, request, rowset){
        if (success) {
          success.call(scope, xmla, request, rowset);
        }
      },
      error: function(xmla, request, exception){
        if (error) {
          error.call(scope, xmla, request, exception);
        }
      }
    };

    this.xmla.discoverDBCatalogs(request);
  },
  renderRowset: function(rowset, fieldNames) {
    try {
      var result,
          thead = "", cols = "", tbody = "",
          fieldCount, fieldDef, fieldName, field, i
      ;
      if (rowset.hasMoreRows()) {
        if (!fieldNames) {
          fieldNames = rowset.getFieldNames();
        }
        fieldCount = fieldNames.length;
        for (i = 0; i < fieldCount; i++){
          fieldName = fieldNames[i];
          fieldDef = rowset.fieldDef(fieldName);
          var className = fieldDef.type;
          if (className !== null && className.indexOf(":") !== -1) {
            className = className.substr(className.lastIndexOf(":") + 1);
          }
          cols += "<col class=\"" + className + "\"/>";
          thead += "<th>" + escXml(fieldDef.label) + "</th>";
        }
        thead = "<thead><tr>" + thead + "</tr></thead>";
        var rowCount = 0;
        while (rowset.hasMoreRows()){
          rowCount++;
          for (i = 0; i < fieldCount; i++){
            fieldName = fieldNames[i];
            field = rowset.fieldVal(fieldName);
            fieldDef = rowset.fieldDef(fieldName);
            className = fieldDef.type;
            if (className !== null && className.indexOf(":") !== -1) {
              className = className.substr(className.lastIndexOf(":") + 1);
            }
            if (className === "dateTime" && typeof(field)==="number") {
              field = new Date(field);
            }
            tbody += "<td class=\"" + className + "\">" + escXml(field) + "</td>";
          }
          tbody = "<tr>" + tbody + "</tr>";
          rowset.nextRow();
        }
        tbody = "<tbody>" + tbody + "</tbody>";
        result = "<table class=\"rowset\">" + cols + thead + tbody + "</table>" +
                  "<br/>" + rowCount + " rows in set.";
      }
      else {
        result = "No rows to display.";
      }
      this.writeResult(result);
    }
    catch (e) {
      this.error(e);
    }
  },
  parseWhereClause: function(){
    var restrictions = {}, tokenizer = this.tokenizer;
    if (!tokenizer.hasMoreTokens()) {
      return restrictions;
    }
    var token, left, relop, right, expect = "WHERE";
    try {
      do {
        //get WHERE or AND
        token = tokenizer.nextToken();
        if (token.type !== "identifier" || String(token.text).toUpperCase() !== expect) {
          throw {
            expected: expect,
            found:token
          };
        }
        expect = "AND";

        //get left
        if (!tokenizer.hasMoreTokens()) {
          throw {
            expected: "expression",
            found: "end of statement"
          };
        }
        token = tokenizer.nextToken();
        if (token.type !== "identifier") {
          throw {
            expected: "identifier",
            found: token
          };
        }
        left = token;

        //get relop
        if (!tokenizer.hasMoreTokens()) {
          throw {
            expected: "=",
            found: "end of statement"
          };
        }
        token = tokenizer.nextToken();
        if (token.type !== "operator" || token.text !== "=") {
          throw {
            expected: "=",
            found: token
          };
        }
        relop = token;

        //get right
        if (!tokenizer.hasMoreTokens()) {
          throw {
            expected: "string value",
            found: "end of statement"
          };
        }
        token = tokenizer.nextToken();
        if (
          token.type !== "double quoted string" &&
          token.type !== "single quoted string"
        ) {
          throw {
            expected: "string value",
            found: token
          };
        }
        right = token;

        restrictions[String(left.text).toUpperCase()] = right.text.substr(1, right.text.length - 2);
      } while (tokenizer.hasMoreTokens());
    }
    catch (e) {
      if (e.expected && e.found) {
        this.showExpectedError(e.expected, e.found);
        return null;
      }
      else {
        throw e;
      }
    }
    return restrictions;
  },
  setPropertyMap: {
    PROMPT: {
      helpText: "Set the text that is to be used as prompt.",
      property: "defaultPrompt",
      expected: ["single quoted string", "double quoted string", "identifier"],
      setter: "setPrompt"
    },
    MEMBER_PROPERTY: {
      helpText: "Set the member property that will be used in the headings of MDX dataset output.",
      property: "memberPropertyToRender",
      expected: ["single quoted string", "double quoted string", "identifier"],
      values: {
        CAPTION: "Caption",
        NAME: "UName"
      }
    },
    CELL_PROPERTY: {
      helpText: "Set the cell property that will be used for the cell values of MDX dataset output.",
      property: "cellPropertyToRender",
      expected: ["single quoted string", "double quoted string", "identifier"],
      values: {
        VALUE: "Value",
        FMTVALUE: "FmtValue"
      }
    }
  },
  getSetProperty: function(keyword){
    if (keyword.type && keyword.text) {
      keyword = keyword.text;
    }
    return this.setPropertyMap[keyword.toUpperCase()];
  },
  getSetPropertyValueList: function(keyword){
    var prop;
    switch (typeof(keyword)){
      case "string":
        prop = this.getSetProperty(keyword);
        break;
      case "object":
        prop = keyword;
        break;
      default:
        throw "Not a valid property";
    }
    var value, list = [];
    for (value in prop.values) {
      list.push(value);
    }
    return list.join(", ");
  },
  getSetPropertyList: function(){
    if (!this.setPropertyList) {
      var keyword, list = "", map = this.setPropertyMap;
      for (keyword in map) {
        if (list) {
          list += ", ";
        }
        list += keyword;
      }
      this.setPropertyList = list;
    }
    return this.setPropertyList;
  },
  handleSet: function(){
    var me = this, tokenizer = me.tokenizer, token, func;
    var hasMoreTokens = tokenizer.hasMoreTokens();
    var prop, token, text;
    if (hasMoreTokens) {
      token = tokenizer.nextToken();
      prop = this.getSetProperty(token);
    }
    if (!hasMoreTokens || !prop) {
      this.showExpectedError(
        "one of " + this.getSetPropertyList(),
        hasMoreTokens ? token : "end of statement"
      );
      return;
    }

    var expected;
    if (prop.values) {
      expected = "";
      var keyword;
      for (keyword in prop.values) {
        if (expected) {
          expected += " ,";
        }
        expected += keyword;
      }
    }
    else
    if (prop.expected){
      expected = prop.expected.join(", ");
    }

    if (!tokenizer.hasMoreTokens()){
      if (expected) {
        this.showExpectedError(expected, "end of statement");
      }
      else {
        this.error("Unexpected error: property does not provide a hint for an expected value.");
      }
      return;
    }

    token = tokenizer.nextToken();
    if (prop.expected.indexOf(token.type) === -1) {
      this.showExpectedError(expected, token);
      return;
    }

    var value, propValue;
    switch (token.type) {
      case "single quoted string":
      case "double quoted string":
        value = token.text.substr(1, token.text.length - 2);
        break;
      default:
        value = token.text;
    }

    if (prop.values) {
      value = value.toUpperCase();
      var keyword;
      for (keyword in prop.values) {
        if (keyword === value) {
          propValue = prop.values[keyword];
          break;
        }
      }
    }
    else {
      propValue = value;
    }

    if (tokenizer.hasMoreTokens()) {
      token = tokenizer.nextToken();
      this.showExpectedError("end of statement", token);
      return;
    }
    this.setProperty(prop, propValue);
  },
  setPrompt: function(value) {
    this.prompt = this.defaultPrompt = value + "> ";
    var me = this;
    setTimeout(
      function(){
        me.updateCaretPosition();
      }, 50
    );
  },
  setProperty: function(prop, value){
    var setter = prop.setter;
    if (setter) {
      if (typeof(prop.setter) === "string") {
        setter = this[prop.setter];
      }
      if (typeof(setter) === "function") {
        setter.call(this, value);
      }
      else {
        this.error("Unexpected error: invalid setter for property.");
      }
    }
    else {
      this[prop.property] = value;
    }
  },
  showKeywordMethodMap: {
    CATALOG: "showCurrentCatalog",
    CATALOGS: "discoverDBCatalogs",
    CUBES: "discoverMDCubes",
    DIMENSIONS: "discoverMDDimensions",
    FUNCTIONS: "discoverMDFunctions",
    HIERARCHIES: "discoverMDHierarchies",
    LEVELS: "discoverMDLevels",
    MEASURES: "discoverMDMeasures",
    MEMBERS: "discoverMDMembers",
    PROPERTIES: "discoverMDProperties",
    SETS: "discoverMDSets"
  },
  getShowMethodName: function(keyword){
    if (keyword.type && keyword.text) {
      keyword = keyword.text;
    }
    keyword = keyword.toUpperCase();
    return this.showKeywordMethodMap[keyword];
  },
  getShowKeywordList: function(){
    if (!this.showKeywordList) {
      var keyword, list = "", map = this.showKeywordMethodMap;
      for (keyword in map) {
        if (list) {
          list += ", ";
        }
        list += keyword;
      }
      this.showKeywordList = list;
    }
    return this.showKeywordList;
  },
  showExpectedShowKeywordError: function(token, hasMoreTokens){
    this.showExpectedError(
      "one of " + this.getShowKeywordList(),
      hasMoreTokens ? token : "end of statement"
    );
  },
  handleShow: function(){
    var me = this, tokenizer = me.tokenizer, token, func;
    var hasMoreTokens = tokenizer.hasMoreTokens();
    var funcName, token, text;
    if (hasMoreTokens) {
      token = tokenizer.nextToken();
      funcName = this.getShowMethodName(token);
    }
    if (!hasMoreTokens || !funcName) {
      this.showExpectedShowKeywordError(token, hasMoreTokens);
      return;
    }

    if (funcName === "showCurrentCatalog") {
      if (tokenizer.hasMoreTokens()) {
        token = tokenizer.nextToken();
        this.showExpectedError("end of statement", token);
        return;
      }
      this[funcName].call(this, true);
      return;
    }

    var restrictions = this.parseWhereClause();
    if (restrictions === null) {
      return;
    }
    var request = this.xmlaRequest;
    var catalog = this.getCurrentCatalog();
    if (catalog && funcName !== "discoverDBCatalogs" && funcName !== "discoverMDFunctions") {
      request.properties.Catalog = catalog;
      restrictions.CATALOG_NAME = catalog;
    }
    else {
      delete restrictions.CATALOG_NAME;
    }
    request.restrictions = restrictions;

    switch (funcName) {
      case "discoverDBCatalogs":
      case "discoverMDFunctions":
        request.callback = function(){
          if (catalog) {
            request.properties.Catalog = catalog;
          }
          delete request.callback;
        }
        delete request.properties.Catalog;
        if (funcName === "discoverDBCatalogs"){
          request.restrictions = {};
        }
        break;
      default:
        if (!this.checkCatalogSet(request)) {
          return;
        }
        break;
    }
    request.success = function(xmla, request, rowset) {
      request.restrictions = {};
      var start = new Date();
      me.renderRowset(rowset);
      var end = new Date();
      me.writeResult(
        "Query took: " +
        me.formatTime(request.start, start) +
        "; Rendering took: " +
        me.formatTime(start, end) +
        "."
      );
    };
    request.error = function(xmla, request, exception) {
      request.restrictions = {};
      me.error("Unexpected error.");
    };
    var func = this.xmla[funcName];
    if (typeof(func) === "function") {
      request.start = new Date();
      func.call(this.xmla, request);
    }
    else {
      //shouldn't arrive here.
      me.error("Unexpected error: xmla4js does not support function " + funcName + "()");
    }
  },
  formatTime: function(start, end){
    start = start.getTime();
    end = end.getTime();
    var time = end - start;
    if (time >= 1000) {
      time = (time / 1000) + " seconds";
    }
    else {
      time += " miliseconds"
    }
    return time;
  },
  showCurrentCatalog: function(append){
    var catalog = this.getCurrentCatalog();
    if (catalog) {
      this.writeResult("Current catalog set to \"" + catalog + "\".", append);
    }
    else {
      this.showNoCatalogSet();
    }
  },
  showNoCatalogSet: function(){
    this.error("No catalog selected. Please run the USE command to select a catalog.", true);
  },
  getCurrentCatalog: function() {
    return this.currentCatalog;
  },
  checkCatalogSet: function(request) {
    if (typeof(request) === "undefined") {
      request = this.xmlaRequest;
    }
    if (typeof(request.properties) === "undefined") {
      request.properties = {};
    }
    var catalog = this.getCurrentCatalog();
    if (typeof(catalog) === "undefined") {
      this.showNoCatalogSet();
      return false;
    }
    return catalog;
  },
  tutorialLine: "<a class=\"link\" target=\"_blank\" href=\"https://github.com/rpbouman/pash/wiki/Pash---The-Pentaho-Analysis-Shell\">" +
                "https://github.com/rpbouman/pash/wiki/Pash---The-Pentaho-Analysis-Shell" +
                "</a>",
  extractTextForShowMethod: function(methodName) {
    var text = this.xmlaSourceText;
    var indexOfMethodDoc = text.indexOf("@method " + methodName);
    if (indexOfMethodDoc === -1) {
      throw "No method " + methodName + " found.";
    }
    text = text.substr(0, indexOfMethodDoc);
    var indexOfDoc = text.lastIndexOf("/**");
    if (indexOfDoc === -1) {
      throw "Start of documentation for method " + methodName + " not found.";
    }
    text = text.substr(indexOfDoc);
    text = text.replace(/\n\*\s*/g, "");

    var indexOfTable;
    indexOfTable = text.indexOf("</table>");
    if (indexOfTable === -1) {
      throw "No column table found";
    }
    text = text.substr(0, indexOfTable + "</table>".length);
    indexOfTable = text.indexOf("<table");
    if (indexOfTable === -1) {
      throw "No column table found";
    }
    text = text.substr(indexOfTable);
    return text;
  },
  getXmlaSourceText: function(callback, scope) {
    var me = this;
    var location = document.location;
    var origin = location.protocol + "//" + location.host;
    var url = origin + location.pathname.replace(/html\/index.html/, "js/Xmla.js");
    var xhr = XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("MSXML2.XMLHTTP.3.0");
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function(){
      switch (this.readyState) {
        case 0:
          //options.aborted(options, this);
          break;
        case 4:
          if (xhr.status === 200){
            callback.call(scope, xhr.responseText);
          }
          break;
        default:
      }
    };
    xhr.send(null);
  },
  getHelpTextForShowMethod: function(methodName, callback, scope){
    if (this.xmlaSourceText) {
      var helpText = this.extractTextForShowMethod(methodName);
      callback.call(scope, helpText);
    }
    else {
      this.getXmlaSourceText(function(xmlaSourceText){
        this.xmlaSourceText = xmlaSourceText;
        this.getHelpTextForShowMethod(methodName, callback, scope);
      }, this);
    }
  },
  showHelpForShowMethod: function(methodName) {
    this.getHelpTextForShowMethod(methodName, function(helpText){
      this.writeResult(helpText, false);
    }, this);
  },
  handleHelp: function(){
    var me = this, tokenizer = me.tokenizer, token, text, message = "";
    while (tokenizer.hasMoreTokens()){
      token = tokenizer.nextToken();
      if (!token || !token.text){
        //debugger;
        continue;
      }
      text = token.text.toUpperCase();
      switch (text) {
        case "HELP":
          message += "Type HELP &lt;commmand&gt; to get help about a specific shell command." +
                     "<br/>Valid values for &lt;commmand&gt; are HELP, SHOW, and USE." +
                     "<br/>Check out the tutorial:" +
                     "<br/>" + this.tutorialLine
          ;
          break;
        case "SET":
          if (tokenizer.hasMoreTokens()) {
            token = tokenizer.nextToken();
            var prop = this.getSetProperty(token.text);
            if (prop) {
              if (prop.helpText) {
                message += prop.helpText;
              }
              else {
                message +=  "Set the " + token.text.toUpperCase() + " property.";
              }
              if (prop.values) {
                message += "<br/>Valid values are: " + this.getSetPropertyValueList(prop);
              }
            }
            else {
              message +=  "<br/>No such property: " + token.text.toUpperCase();
            }
          }
          else {
            message +=  "Type SET &lt;property&gt; &lt;value&gt; to change the value of a Pash property." +
                        "<br/>Properties control how Pash behaves." +
                        "<br/>Valid properties are " + this.getSetPropertyList() + "."
            ;
          }
          break;
        case "SHOW":
          if (tokenizer.hasMoreTokens()) {
            token = tokenizer.nextToken();
            var methodName = this.getShowMethodName(token);
            if (!methodName) {
              this.showExpectedShowKeywordError(token, true);
              return;
            }
            else
            if (methodName === "showCurrentCatalog") {
              message = "Shows the name of the currently selected Catalog.";
              break;
            }
            var hasMoreTokens = tokenizer.hasMoreTokens();
            if (hasMoreTokens) {
              this.showExpectedError("end of statement", token);
              return;
            }
            this.showHelpForShowMethod(methodName);
            return;
          }
          else {
            message +=  "Type SHOW &lt;item&gt; to get information about a particular kind of item (metadata)." +
                        "<br/>Valid values for &lt;item&gt; are " + this.getShowKeywordList() + "." +
                        "<br/>"+
                        "<br/>SHOW CATALOGS always lists all available catalogs; SHOW CATALOG shows the current catalog." +
                        "<br/>In order to SHOW something other than CATALOGS, you first need to select a particular catalog with the USE command." +
                        "<br/>" +
                        "<br/>Most SHOW commands can optionally have a WHERE clause." +
                        "<br/>For example, to see which measures are available in the 'Sales' cube, you'd write:" +
                        "<br/>" +
                        "<br/>SHOW MEASURES WHERE CUBE_NAME = 'Sales'"
                        "<br/>" +
                        "<br/>The WHERE clause may be required by certain XML/A providers in order to execute a particular SHOW command."
                        "<br/>"+
                        "<br/>For a description of the type of info returned by a particular SHOW &lt;item&gt; command, type:"+
                        "<br/>"+
                        "<br/>HELP SHOW &lt;item&gt;"
            ;
          }
          break;
        case "USE":
          message += "Type USE &lt;catalog&gt; to select a particular catalog to work with." +
                     "<br/>You can always use the SHOW CATALOGS command to list all available catalogs." +
                     "<br/>After selecting a specific catalog, you can use the other SHOW command, and execute MDX queries."
          ;
          break;
        default:
          message += "<br/>Unrecognized command: \"" + token.text + "\".";
      }
    }
    if (!message.length) {
      message = "Type an MDX query, or one of the shell commands." +
                "<br/>Valid commands are: SET, SHOW, USE and HELP." +
                "<br/>To run the command or query, type a semi-colon (;), then press the Enter key." +
                "<br/>" +
                "<br/>To get help about a specific shell command, type HELP &lt;commmand&gt;." +
                "<br/>Refer to the MDX specification for more information about writing MDX queries." +
                "<br/>" +
                "<br/>Check out the tutorial here:" +
                "<br/>" + this.tutorialLine +
                "<br/>"
    }
    this.writeResult(message + "<br/>", true);
  },
  renderDataset: function (dataset) {
//    try{
      var me = this, axisCount = dataset.axisCount(),
          cellset = dataset.getCellset(),
          cellIndex = 0;
      ;

      function getTupleName(tuple, hierarchy) {
          var n = hierarchy ? hierarchy.index : tuple.members.length-1;
          for (var mName = "", i = 0; i <= n; i++) {
              if (mName!=="") mName += ",";
              mName += tuple.members[i][Xmla.Dataset.Axis.MEMBER_UNIQUE_NAME];
          }
          return mName;
      }

      function renderTuple(tuple) {
          me.writeResult(getTupleName(tuple));
      }

      function renderMember(member){
          return escXml(member[me.memberPropertyToRender]);
      }

      function renderHeader(axis, dummy) {
          var thead = "<thead>";
          var rowAxis;
          var i = 0, n = axis.hierarchyCount() - 1;
          axis.eachHierarchy(function(hierarchy){
            thead += "<tr>";
            if (!i && dataset.hasRowAxis()) {
              var rowSpan = axis.hierarchyCount() - 1;
              rowAxis = dataset.getRowAxis();
              var colSpan = rowAxis.hierarchyCount();
              if (rowSpan) {
                thead += "<td rowspan=\"" + rowSpan + "\" colspan=\"" + colSpan + "\"><br/></td>";
              }
            }
            if (i === n && dataset.hasRowAxis()) {
              rowAxis.eachHierarchy(function(hierarchy){
                thead += "<th>" + escXml(hierarchy.name) + "</th>";
              });
            }
            axis.eachTuple(function(tuple){
              var member = tuple.members[i];
              thead += "<th>" + renderMember(member) + "</th>";
            });
            thead += "</tr>";
            i++;
          });
          thead += "</thead>";
          return thead;
      }

      var cellExtractor = cellset["cell" + me.cellPropertyToRender];

      function renderCells(axis) {
          var td = "";
          axis.eachTuple(function(){
              var value;
              if (cellset.cellOrdinal() === cellIndex++) {
                  value = cellExtractor.call(cellset);
                  cellset.nextCell();
              }
              else {
                  value = "";
              }
              var className = typeof(value);
              if (className === "string") {
                className = " class=\"" + className + "\"";
                value = escXml(value);
              }
              else {
                className = "";
              }
              td += "<td" + className + ">" + value + "</td>";
          });
          return td;
      }

      function renderTable() {
        var tbody, thead, value,
            columnAxis = dataset.getColumnAxis(),
            rowAxis = rowAxis = dataset.getRowAxis()
        ;
        thead = renderHeader(columnAxis, true);
        tbody = "<tbody>";
        var i;
        rowAxis.eachTuple(function(tuple){
          tbody += "<tr>";
          i = 0;
          rowAxis.eachHierarchy(function(hierarchy){
            var member = tuple.members[i];
            tbody += "<th>" + renderMember(member) + "</th>";
            i++;
          });
          tbody += renderCells(columnAxis);
          tbody += "</tr>";
        });
        tbody += "</tbody>";
        me.writeResult("<table class=\"dataset\">" + thead + tbody + "</table>");
      }

      function renderAxis(axisId) {
          var axis;
          if (axisId !== -1) {
            axis = dataset.getAxis(axisId);
          }
          switch (axisId) {
              case -1:
                  me.writeResult(cellset.cellValue());
                  break;
              case 0:
                  me.writeResult(
                    "<table class=\"dataset\">" +
                        renderHeader(axis, false) +
                        "<tbody>" +
                          "<tr>" +
                            renderCells(axis) +
                          "</tr>" +
                        "</tbody>" +
                    "</table>"
                  );
                  break;
              case 1:
                  renderTable();
                  break;
              default:
                  axis.eachTuple(function(tuple){
                      renderTuple(tuple);
                      renderAxis(axisId-1);
                  });
          }
      }
      renderAxis(axisCount - 1);
//    }
//    catch(e){
//      this.error(e);
//    }
  },
  formatCount: function(count, maxCount){
    count = String(count);
    maxCount = String(maxCount);
    while (count.length < maxCount.length) {
      count = " " + count;
    }
    return count;
  },
  handleExecute: function(){
    var me = this;
    var statement = me.statementLines.join("\n");
    statement = statement.substr(0, statement.lastIndexOf(";"));
    statement = statement.replace(/\xA0/g, " ");
    var request = me.xmlaRequest;
    delete request.restrictions;
    delete request.error;
    if (!request.properties) {
      request.properties = {};
    }
    request.properties.Catalog = this.getCurrentCatalog();
    request.properties[Xmla.PROP_FORMAT] = Xmla.PROP_FORMAT_MULTIDIMENSIONAL;
    request.statement = statement;
    request.success = function(xmla, request, data){
      var start = new Date();
      if (data instanceof Xmla.Dataset) {
        me.renderDataset(data);
        var tupleCounts = [], hierarchyCounts = [], memberCounts = [];
        var i, axisCount = data.axisCount(), axis, tupleCount, hierarchyCount,
            maxHierarchies, maxTuples, maxMembers
        ;
        for (i = 0; i < axisCount; i++){
          axis = data.getAxis(i);
          tupleCount = axis.tupleCount()
          tupleCounts.push(tupleCount);
          hierarchyCount = axis.hierarchyCount();
          hierarchyCounts.push(hierarchyCount);
          memberCounts.push(tupleCount * hierarchyCount);
        }
        maxHierarchies = Math.max.apply(null, hierarchyCounts);
        maxTuples = Math.max.apply(null, tupleCounts);
        maxMembers = Math.max.apply(null, memberCounts);
        for (i = 0; i < axisCount; i++){
          me.writeResult(
            me.formatCount(tupleCounts[i], maxTuples) +
            " tuples * " +
            me.formatCount(hierarchyCounts[i], maxHierarchies) +
            " hierarchies = " +
            me.formatCount(memberCounts[i], maxMembers) +
            " members on Axis(" + i + ")"
          );
        }
        me.writeResult(data.getCellset().cellCount() + " cells in cellset.");
      }
      else
      if (data instanceof Xmla.Rowset) {
        //currently we don't expect to get here.
        me.renderRowset(data);
      }
      else {
        throw "Unexpected error: result is not a rowset or a dataset";
      }
      var end = new Date();
      me.writeResult(
        "Query took: " +
        me.formatTime(request.start, start) +
        "; Rendering took: " +
        me.formatTime(start, end) +
        "."
      );
    };
    request.start = new Date();
    this.xmla.execute(request);
  },
  parse: function(statement){
    var me = this, tokenizer = me.tokenizer;
    tokenizer.tokenize(statement);
    var token = tokenizer.nextToken();
    if (!token) {
      return;
    }
    try {
      switch (token.text.toUpperCase()) {
        case "SELECT":
        case "WITH":
          me.handleExecute();
          break;
        case "SET":
          me.handleSet();
          break;
        case "SHOW":
          me.handleShow();
          break;
//        case "TEST":
//          me.handleTest();
//          break;
        case "USE":
          me.handleUse();
          break;
        case "HELP":
          me.handleHelp();
          break;
        default:
          this.showExpectedError("a shell command (HELP, SET, SHOW or USE) or a MDX query (SELECT or WITH)", token, true);
      }
    }
    catch (e) {
      var errorText;
      if (typeof(e) === "string") {
        errorText = e;
      }
      else
      if (typeof(e.getMessage) === "function") {
        errorText = e.getMessage();
      }
      else {
        errorText = e.toString();
      }
      me.error(errorText, true);
    }
  },
  writeResult: function(result, append){
    var line = this.getCurrentLine();
    var container = document.createElement("DIV");
    container.className = "result";
    container.innerHTML = result;
    if (append) {
      line.parentNode.appendChild(container);
    }
    else {
      line.parentNode.insertBefore(container, line);
    }
    var me = this;
    setTimeout(function(){
      me.alignDom();
    }, 20);
  },
  error: function(message, append){
    this.writeResult("Error: " + message, append);
  },
  initDatasources: function(){
    switch (arguments.length) {
      case 0:
        var location = document.location, urls = [];

        if (location.search) {
          var search = location.search.substr(1); //get rid of initial ? char.
          search = search.split("&"); //cut in individual parameters;
          var i, n = search.length, param;
          for (i = 0; i < n; i++) {
            param = search[i];
            param = param.split("=");
            if (param[0].toUpperCase() !== "XMLAURL") {
              continue;
            }
            urls.push(decodeURIComponent(param[1]));
            break;
          }
        }
        if (!urls.length) {
          var origin = location.protocol + "//" + location.host;
          var base = origin + "/";
          //mondrian, f.e. http://localhost:8080/mondrian/xmla
          urls.push(base + "mondrian/xmla");
          //jasperreports, f.e. http://localhost:8080/jasperserver/xmla
          urls.push(base + "jasperserver/xmla");
          //icCube, f.e. http://localhost:8080/icCube/xmla
          urls.push(base + "icCube/xmla");
          //pentaho, f.e. http://localhost:8080/pentaho/Xmla
          urls.push(base + location.pathname.split("/")[1] + "/Xmla");
          //msas, f.e. http://localhost/OLAP/msmdpump.dll
          urls.push(base + "OLAP/msmdpump.dll");
        }
        this.initDatasources(urls, 0);
        break;
      case 2:
        var urls = arguments[0], index = arguments[1];
        if (index >= urls.length) {
          var title = "Error discovering datasources";
          var msg = "Unable to find the XML/A service. Try specifying the URL of the XML/A service using the \"XmlaUrl\" URL query parameter."
          showAlert(title, msg);
          this.writeResult("<br/>" + title + ".<br/>" + msg);
          return;
        }
        var me = this;
        this.xmla.discoverDataSources({
          url: urls[index],
          success: function(xmla, request, rowset){
            rowset.eachRow(function(row){
              me.writeResult(
                "<br/>Connected to datasource " + row.DataSourceName +
                "<br/>DataSourceInfo: " + row.DataSourceInfo +
                "<br/>Description: " + row.DataSourceDescription +
                "<br/>URL: " + row.URL +
                "<br/>Provider: " + row.ProviderName + ", type: " + row.ProviderType +
                "<br/>Authentication mode: " + row.AuthenticationMode,
                ""
              );
              me.xmlaRequest.properties.DataSourceInfo = row.DataSourceInfo;
              xmla.setOptions({
                url: request.url
              });

              me.handleHelp();
              me.createLine();
              me.prompt = me.defaultPrompt;
              me.createLine("", me.prompt);
            });
          },
          error: function(xmla, request){
            var exception = request.exception;
            if (exception.code === -10) {
              var data = exception.data;
              switch (data.status) {
                default:
                  me.initDatasources(urls, ++index);
                  break;
              }
            }
            else
            if (exception.code.indexOf("SOAP-ENV") === 0) {
              me.error(exception.code + ": " + exception.message);
              try {
                var xml = request.xhr.responseXML;
                var code = xml.getElementsByTagName("code")[0].firstChild.data;
                var desc = xml.getElementsByTagName("desc")[0].firstChild.data;
                me.error(desc + " (" + code + ")");
              }
              catch (e) {
              }
            }
          }
        });
        break;
      default:
    }
  },
  getXmla: function(){
    return this.xmla;
  },
  getXmlaRequest: function(){
    return this.xmlaRequest;
  }
};

var prop, wshPrototype = Wsh.prototype;
for (prop in wshPrototype) {
  if (typeof(xmlashPrototype[prop]) !== "undefined") continue;
  xmlashPrototype[prop] = wshPrototype[prop];
}

Xmlash.prototype = xmlashPrototype;
exports.Pash = Xmlash;
})(typeof(exports) === "object" ? exports : window);
