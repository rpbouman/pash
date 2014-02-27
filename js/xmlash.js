(function(){

//http://en.wikipedia.org/wiki/Levenshtein_distance
function levenstein(s1, l1, s2, l2) {
  if (l1 == 0) return l2;
  if (l2 == 0) return l1;
 
  /* test if last characters of the strings match */
  var cost = (s1[l1 - 1] == s2[l2 - 1]) ? 0 : 1;
 
  /* return minimum of delete char from s, delete char from t, and delete char from both */
  return Math.min(
    levenstein(s1, l1 - 1, s2, l2    ) + 1,
    levenstein(s1, l1,     s2, l2 - 1) + 1,
    levenstein(s1, l1 - 1, s2, l2 - 1) + cost
  );  
}

function editDistance(a, b){
  if(a.length == 0) return b.length; 
  if(b.length == 0) return a.length; 
 
  var matrix = [];
 
  // increment along the first column of each row
  var i;
  for(i = 0; i <= b.length; i++){
    matrix[i] = [i];
  }
 
  // increment each column in the first row
  var j;
  for(j = 0; j <= a.length; j++){
    matrix[0][j] = j;
  }
 
  // Fill in the rest of the matrix
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) == a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                Math.min(matrix[i][j-1] + 1, // insertion
                                         matrix[i-1][j] + 1)); // deletion
      }
    }
  }
 
  return matrix[b.length][a.length];
};

var xmlashPrototype = {
  //      1     2     34         5          678                9    10                     11           12                    13
  regex: /(\s+)|(\w+)|(("[^"]*")|('[^']*'))|(((\/\/|--)[^\n]*)|(\/\*([^\*]|\*[^\/])*\*\/))|(\[[^\]]+\])|([\.,\*\-\+\(\):<>=])|(;)/g,
  tokenTypes: {
    1: "whitespace",
    2: "identifier",
    3: "string",
    4: "double quoted string",
    5: "singe quoted string",
    6: "comment",
    7: "comment line",
    8: false,
    9: "comment block",
    10: false,
    11: "square braces",
    12:"operator",
    13: "terminator"
  },
  leaveLineHandler: function(){
    var text = this.getLineText().textContent + "\n";
    var token, terminator = false, afterTerminator = false, prompt;
    this.tokenize(text);
    while (token = this.nextToken()) {
      if (terminator) afterTerminator = true;
      if (token.type === "terminator") {
        terminator = true;
      }
    }
    this.statementLines.push(text);
    if (terminator) {
      this.prompt = "pash> ";
      if (afterTerminator) {
        this.error("Tokens found after statement terminator.");
      }
      else {
        this.handleCommand();
      }
    }
    else {
      this.prompt = "   -> ";
    }
  },
  handleCommand: function(){
    var statement = this.statementLines.join("\n");
    statement = statement.substr(0, statement.lastIndexOf(";"));
    var tree = this.parse(statement);
    this.tokens.length = 0;
    this.currentToken = -1;
    this.statementLines.length = 0;
  },
  handleUse: function(){
    var me = this;
    var token = this.nextToken();
    if (token && (token.type === "double quoted string" || token.type === "single quoted string")) {
      token.type = "identifier";
      token.text = token.text.substr(1, token.text.length - 2);
    } 
    if (!token || token.type !== "identifier") {
      this.error("Expected a catalog name.");
      return;
    }
    var request = me.xmlaRequest;
    var oldCatalog = request.properties.Catalog;
    request.properties.Catalog = token.text;
    me.xmla.discoverDBCatalogs({
      success: function(xmla, request, rowset){
        rowset.eachRow(function(row){
          me.catalog = row.CATALOG_NAME;
          me.writeResult("Current catalog set to \"" + me.catalog + "\".");
          this.prompt = "pash> ";
        });
      },
      error: function(){
        delete request.properties.Catalog;
        var c1 = token.text.toUpperCase();
        me.xmla.discoverDBCatalogs({
          success: function(xmla, request, rowset){
            var message = "", num = 0;
            rowset.eachRow(function(row){
              var c2 = row.CATALOG_NAME.toUpperCase();
              if (editDistance(c1, c2) < 5) {
                if (message.length) message += ", "
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
            request.properties.Catalog = oldCatalog;
          },
          error: function(){
            request.properties.Catalog = oldCatalog;
          }
        });
        request.properties.Catalog = oldCatalog;
      }
    });
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
                thead += "<th>" + fieldDef.label + "</th>";
            }
            thead = "<thead><tr>" + thead + "</tr></thead>";
            while (rowset.hasMoreRows()){
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
                    tbody += "<td class=\"" + className + "\">" + field + "</td>";
                }
                tbody = "<tr>" + tbody + "</tr>";
                rowset.nextRow();
            }
            tbody = "<tbody>" + tbody + "</tbody>";
            result = "<table>" + cols + thead + tbody + "</table>";
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
  handleShow: function(){
    var me = this, token, func;
    var keywords = {
      CATALOGS: "discoverDBCatalogs",
      CUBES: "discoverMDCubes",
      DIMENSIONS: "discoverMDDimensions",
      HIERARCHIES: "discoverMDHierarchies",
      LEVELS: "discoverMDLevels",
      MEASURES: "discoverMDMeasures",
      MEMBERS: "discoverMDMembers"
    };
    if (!this.hasMoreTokens() || typeof(func = keywords[(token = this.nextToken()).text.toUpperCase()])!=="string") {
    
      this.error(
        "<br/>Unrecognized command argument \"" + token.text + "\"" + 
        "<br/>Expected one of the following instead: CATALOGS, CUBES, DIMENSIONS, HIERARCHIES, MEASURES, MEMBERS, LEVELS.",
        true
      );
      return;
    }
    if (this.hasMoreTokens()) {
      this.error("Extra token \"" + this.nextToken().text + "\" appearing after command argument", true);
      return;
    }
    var request = this.xmlaRequest;
    if (func === "discoverDBCatalogs") {
      delete request.properties.Catalog;
    }
    else {
      if (typeof(request.properties) === "undefined") {
        request.properties = {};
      }
      request.properties.Catalog = this.catalog;
      if (typeof(request.properties.Catalog) === "undefined") {
        this.error("No catalog selected. Please run the USE command to select a catalog.", true);
        return;
      }
    }
    request.success = function(xmla, request, rowset) {
      me.renderRowset(rowset);
    };
    this.xmla[func].call(this.xmla, request);
  },
  handleHelp: function(){
    var token, text, message = "";
    while (this.hasMoreTokens()){
      token = this.nextToken();
      if (!token.text){
        debugger;
        continue;
      }
      text = token.text.toUpperCase();
      switch (text) {
        case "HELP":
          message += "<br/>Type HELP &lt;commmand&gt; to get help about a specific shell command."
                     "<br/>Valid values for &lt;commmand&gt; are HELP, SHOW, and USE."
          ;
          break;
        case "SHOW":
          message += "<br/>Type SHOW &lt;item&gt; to get information about a particular kind of item (metadata)." +
                     "<br/>Valid values for &lt;item&gt; are CATALOGS, CUBES, DIMENSIONS, HIERARCHIES, MEASURES and MEMBERS." +
                     "<br/>"+
                    "<br/>SHOW CATALOGS always lists all available catalogs." + 
                    "<br/>For all other items, you first have to select a particular catalog with the USE command."
          ;
          break;
        case "USE":
          message += "<br/>Type USE &lt;catalog&gt; to select a particular catalog to work with." +
                     "<br/>You can always use the SHOW CATALOGS command to list all available catalogs." +
                     "<br/>After selecting a specific catalog, you can use the other SHOW command, and execute MDX queries."
          ;
          break;
        default:
          message += "<br/>Unrecognized command: \"" + token.text + "\"."; 
      }
    }
    if (!message.length) {
      message = "<br/>Type an MDX query, or one of the shell commands." +
                "<br/>Valid commands are: SHOW, USE and HELP." +
                "<br/>To run the command or query, type a semi-colon (;), then press the Enter key." +
                "<br/>" +
                "<br/>To get help about a specific shell command, type HELP &lt;commmand&gt;." +
                "<br/>Refer to the MDX specification for more information about writing MDX queries."
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
          me.writeResult(tuple);
      }

      function renderHeader(axis, dummy) {
          var thead = "<thead><tr>";
          if (dummy) thead += "<td><br/></td>";
          axis.eachTuple(function(tuple){
              thead += "<td>" + getTupleName(tuple) + "</td>";
          })
          thead += "</tr></thead>";
          return thead;
      }

      function renderCells(axis) {
          var td = "";
          axis.eachTuple(function(){
              if (cellset.cellOrdinal() === cellIndex++) {
                  value = cellset.cellValue();
                  cellset.nextCell();
              }
              else {
                  value = "";
              }
              td += "<td>" + value + "</td>";
          });
          return td;
      }

      function renderTable() {
          var tbody, thead, value,
              columnAxis = dataset.getColumnAxis()
          ;
          thead = renderHeader(columnAxis, true);
          tbody = "<tbody>";
          dataset.getRowAxis().eachTuple(function(tuple){
              tbody += "<tr>";
              tbody += "<td>" + getTupleName(tuple) + "</td>";
              tbody += renderCells(columnAxis);
              tbody += "</tr>";
          });
          tbody += "</tbody>";
          me.writeResult("<table>" + thead + tbody + "</table>");
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
                    "<table>" +
                        renderHeader(axis, false) +
                         "<tr>" +
                            renderCells(axis) +
                         "</tr>" +
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
  handleExecute: function(){
    var me = this;
    var statement = me.statementLines.join("\n");
    statement = statement.substr(0, statement.lastIndexOf(";"));
    var request = me.xmlaRequest;
    if (!request.properties) request.properties = {};
    request.properties[Xmla.PROP_FORMAT] = Xmla.PROP_FORMAT_MULTIDIMENSIONAL;
    request.statement = statement;
    request.success = function(xmla, request, data){
      if (data instanceof Xmla.Dataset) {
        me.renderDataset(data);
      }
      else
      if (data instanceof Xmla.Rowset) {
        //currently we don't expect to get here.
        me.renderRowset(data);
      }
      else {
        //shouldn't arrive here.
      }
    };
    this.xmla.execute(request);
  },
  hasMoreTokens: function(){
    return this.currentToken < this.tokens.length;
  },
  nextToken: function(){
    var token = null;
    var ignoreTokens = {
      whitespace: true,
      "comment line": true,
      "comment block": true,
    };
    while (this.hasMoreTokens()) {
      token = this.tokens[this.currentToken++];
      if (ignoreTokens[token.type]) {
        token = null;
        continue;
      }
      break; 
    }
    return token;
  },
  parse: function(statement){
    var re = this.getRegex();
    this.tokenize(statement);
    var token = this.nextToken();
    if (!token) return;
    switch (token.text.toUpperCase()) {
      case "SELECT":
      case "WITH":
        this.handleExecute();
        break;
      case "SHOW":
        this.handleShow();
        break;
      case "USE":
        this.handleUse();
        break;
      case "HELP":
        this.handleHelp();
        break;
      default:
        this.error("Unrecognized command: " + token.text, true);
    }
  },
  getRegex: function(){
    var flags = "";
    if (this.regex.global) flags += "g"
    if (this.regex.ignoreCase) flags += "i"
    return new RegExp(this.regex.source, flags);
  },
  tokenize: function(text){
    var re = this.getRegex();
    var match, token, i, n, num = 0;
    var type, tokens = [];
    while (match = re.exec(text)){
      num++;
      //ignore whitespace and comments
      if (match[0] === ";" && typeof(terminator) === "undefined") {
        terminator = num;
        terminatorColumn = re.lastIndex;
      }
      token = {text: match[0], index: re.lastIndex};
      for (i = match.length - 1; i >= 0; i--){
        if(match[i] && (type = this.tokenTypes[i])) {
          token.type = type;
          break;
        }
      }
      tokens.push(token);
    }
    this.tokens = tokens;
    this.currentToken = 0;
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
    var me = this;
    me.xmla.discoverDataSources({
      success: function(xmla, request, rowset){
        rowset.eachRow(function(row){
          me.createLine("Connected to datasource " + row.DataSourceName + ".", "");
          me.xmlaRequest.properties.DataSourceInfo = row.DataSourceInfo;
          me.createLine();
          this.prompt = "pash> ";
          me.createLine("", this.prompt);
        });
      }
    });
  }
};

var Xmlash;
(Xmlash = function(conf){
  Wsh.apply(this, arguments);
  this.prompt = "";
  this.statementLines = [];
  var xmlaUrl = document.location.href; 
  var i = xmlaUrl.indexOf("/content");
  xmlaUrl = xmlaUrl.substr(0, i);
  xmlaUrl += "/Xmla";
  this.xmlaRequest = {
    //forceResponseXMLEmulation: true,
    async: true,
    url: xmlaUrl,
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
        this.getTextArea().value = "";
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
      handler: function(xmla, request){
        try {
          var xml = request.xhr.responseXML;
          var code = xml.getElementsByTagName("code")[0].firstChild.data;
          var desc = xml.getElementsByTagName("desc")[0].firstChild.data;
          this.error(desc + " (" + code + ")");
        }
        catch (e) {
          debugger;
        }
        this.blockInput(false);
      },
      scope: this
    }
  ]);
  this.lines = [
    "Pentaho Analysis shell powered by Xmla4js.",
    "Copyright 2014 Roland Bouman.",
    "This program is open source.",
    "",
    "Type a MDX query or one of the shell commands (HELP, SHOW and USE).",
    "Terminate commands with a semicolon (;), then press the Enter key.",
    "",
    "Discovering datasources on " + xmlaUrl
  ];
  this.addListener("leaveLine", this.leaveLineHandler, this);
}).prototype = xmlashPrototype;

var prop, wshPrototype = Wsh.prototype;
for (prop in wshPrototype) {
  if (typeof(xmlashPrototype[prop]) !== "undefined") continue;
  xmlashPrototype[prop] = wshPrototype[prop];
}

var xmlash = new Xmlash({
  caretInterval: 500
});
xmlash.render();
xmlash.initDatasources();

})();
