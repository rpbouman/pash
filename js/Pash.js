(function(exports) {

function escXml(str) {
  if (str === null) {
    return null;
  }
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

var Xmlash = function(conf){
  Wsh.apply(this, arguments);
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
      handler: function(xmla, request, exception){
        var exception = request.exception, code, desc;
        code = exception.code;
        desc = exception.message;
        if (
          request.method === Xmla.METHOD_DISCOVER &&
          request.requestType === Xmla.DISCOVER_DATASOURCES
        ) {
          console.log("Error discovering datasource: " + code + ": " + desc);
        }
        else {
          this.error(desc + " (" + code + ")");
          try { //try to extract code and desc, these are passed by mondrian and often contain the actual information.
            var xml = request.xhr.responseXML;
            var code = xml.getElementsByTagName("code")[0].firstChild.data;
            var desc = xml.getElementsByTagName("desc")[0].firstChild.data;
            this.error(desc + " (" + code + ")");
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
    "MDX shell powered by Xmla4js.",
    "Copyright 2014, 2015 Roland Bouman.",
    "This program is open source.",
  ];
  this.addListener("leaveLine", this.leaveLineHandler, this);
  this.history = new exports.WshHistory(this);
  this.render();
  this.handleHelp();
  this.initDatasources();
};

xmlashPrototype = {
  defaultPrompt: "MDX> ",
  getContinuationPrompt: function() {
    if (!this.continuationPrompt) {
      this.continuationPrompt = this.defaultPrompt.replace(/\w/g, " ").replace(/ >/g, "->");
    }
    return this.continuationPrompt;
  },
  leaveLineHandler: function(){
    var text = this.getLineText().textContent + "\n";
    var tokenizer = this.tokenizer, token,
        terminator = false, afterTerminator = false,
        prompt
    ;
    tokenizer.tokenize(text);
    while (token = tokenizer.nextToken()) {
      if (terminator) afterTerminator = true;
      if (token.type === "terminator") {
        terminator = true;
      }
    }
    this.statementLines.push(text);
    if (terminator) {
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
    var statement = this.getEnteredStatementText();
    statement = statement.substr(0, statement.lastIndexOf(";"));
    var tree = this.parse(statement);
    this.tokenizer.reset();
    this.statementLines.length = 0;
    this.fireEvent("commandHandled");
  },
  handleUse: function(){
    var me = this;
    var token = this.tokenizer.nextToken(), tokenType = token.type;
    if (  token &&
        ( tokenType === "double quoted string" ||
          tokenType === "single quoted string" ||
          tokenType === "square braces"
        )
    ) {
      tokenType = token.type = "identifier";
      token.text = token.text.substr(1, token.text.length - 2);
    }
    if (!token || token.type !== "identifier") {
      this.error("Expected a catalog name.");
      return;
    }
    var request = me.xmlaRequest;
    var oldCatalog = request.properties.Catalog;
    request.restrictions.CATALOG_NAME = request.properties.Catalog = token.text;
    request.success = function(xmla, request, rowset){
      var i = 0;
      rowset.eachRow(function(row){
        if (i){
          throw "Unexpected error setting catalog (multiple catalogs found)";
        }
        me.catalog = row.CATALOG_NAME;
        me.writeResult("Current catalog set to \"" + me.catalog + "\".");
        this.prompt = this.defaultPrompt;
        i++;
      });
      if (i !== 1) {
        request.error(xmla, request, "Could not set catalog");
      }
    }
    request.error = function(){
      delete request.properties.Catalog;
      delete request.restrictions.CATALOG_NAME;
      var c1 = token.text.toUpperCase();
      me.xmla.discoverDBCatalogs({
        success: function(xmla, request, rowset){
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
          request.properties.Catalog = oldCatalog;
        },
        error: function(){
          request.properties.Catalog = oldCatalog;
        }
      });
      request.properties.Catalog = oldCatalog;
    }
    me.xmla.discoverDBCatalogs(request);
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
            tbody += "<td class=\"" + className + "\">" + escXml(field) + "</td>";
          }
          tbody = "<tr>" + tbody + "</tr>";
          rowset.nextRow();
        }
        tbody = "<tbody>" + tbody + "</tbody>";
        result = "<table class=\"rowset\">" + cols + thead + tbody + "</table>";
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
    do {
      //get WHERE or AND
      token = tokenizer.nextToken();
      if (token.type !== "identifier" || String(token.text).toUpperCase() !== expect) {
        throw "Expected keyword: " + expect + ". found: " + token.type + " \"" + token.text + "\"";
      }
      expect = "AND";

      //get left
      if (!tokenizer.hasMoreTokens()) {
        throw "Unexpected end of statement. Expected: expression.";
      }
      token = tokenizer.nextToken();
      if (token.type !== "identifier") {
        throw "Expected: identifier, found: " + token.type + " \"" + token.text + "\"";
      }
      left = token;

      //get relop
      if (!tokenizer.hasMoreTokens()) {
        throw "Unexpected end of statement. Expected: =";
      }
      token = tokenizer.nextToken();
      if (token.type !== "operator" || token.text !== "=") {
        throw "Expected: =, found: " + token.type + " \"" + token.text + "\"";
      }
      relop = token;

      //get right
      if (!tokenizer.hasMoreTokens()) {
        throw "Unexpected end of statement. Expected: string value.";
      }
      token = tokenizer.nextToken();
      if (
        token.type !== "double quoted string" &&
        token.type !== "single quoted string"
      ) {
        throw "Expected: string value, found: " + token.type + " \"" + token.text + "\"";
      }
      right = token;

      restrictions[String(left.text).toUpperCase()] = right.text.substr(1, right.text.length - 2);
    } while (tokenizer.hasMoreTokens());
    return restrictions;
  },
  handleShow: function(){
    var me = this, tokenizer = me.tokenizer, token, func;
    var keywords = {
      CATALOGS: "discoverDBCatalogs",
      CUBES: "discoverMDCubes",
      DIMENSIONS: "discoverMDDimensions",
      HIERARCHIES: "discoverMDHierarchies",
      LEVELS: "discoverMDLevels",
      MEASURES: "discoverMDMeasures",
      MEMBERS: "discoverMDMembers",
      PROPERTIES: "discoverMDProperties",
      SETS: "discoverMDSets"
    };
    var hasMoreTokens = tokenizer.hasMoreTokens();
    var isString;
    if (hasMoreTokens) {
      var token = tokenizer.nextToken();
      var keyWord = token.text;
      keyWord = keyWord.toUpperCase();
      var func = keywords[keyWord];
      isString = typeof(func)!=="string";
    }
    if (!hasMoreTokens || isString) {
      var keyword, list = "";
      for (keyword in keywords) {
        if (list) {
          list += ", ";
        }
        list += keyword;
      }
      this.error(
        "<br/>Unrecognized command argument \"" + (token ? token.text : "") + "\"" +
        "<br/>Expected one of the following instead: " + list + ".",
        true
      );
      return;
    }
    var restrictions = this.parseWhereClause();
    var request = this.xmlaRequest;
    var catalog = request.properties.Catalog;
    if (catalog) {
      restrictions.CATALOG_NAME = catalog;
    }
    else {
      delete restrictions.CATALOG_NAME;
    }
    request.restrictions = restrictions;
    if (func === "discoverDBCatalogs") {
      request.callback = function(){
        request.properties.Catalog = catalog;
        delete request.callback;
      }
      delete request.properties.Catalog;
      delete request.restrictions.CATALOG_NAME;
    }
    else
    if (!this.checkCatalogSet(request)) {
      return;
    }
    request.success = function(xmla, request, rowset) {
      me.renderRowset(rowset);
    };
    request.error = function(xmla, request, exception) {
      me.error("Unexpected error.");
    };
    this.xmla[func].call(this.xmla, request);
  },
  checkCatalogSet: function(request) {
    if (typeof(request) === "undefined") {
      request = this.xmlaRequest;
    }
    if (typeof(request.properties) === "undefined") {
      request.properties = {};
    }
    var catalog = request.properties.Catalog;
    if (typeof(catalog) === "undefined") {
      this.error("No catalog selected. Please run the USE command to select a catalog.", true);
      return false;
    }
    return catalog;
  },
  tutorialLine: "<a class=\"link\" target=\"_blank\" href=\"https://github.com/rpbouman/pash/wiki/Pash---The-Pentaho-Analysis-Shell\">" +
                "https://github.com/rpbouman/pash/wiki/Pash---The-Pentaho-Analysis-Shell" +
                "</a>",
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
          message += "<br/>Type HELP &lt;commmand&gt; to get help about a specific shell command." +
                     "<br/>Valid values for &lt;commmand&gt; are HELP, SHOW, and USE." +
                     "<br/>Check out the tutorial:" +
                     "<br/>" + this.tutorialLine
          ;
          break;
        case "SHOW":
          message += "<br/>Type SHOW &lt;item&gt; to get information about a particular kind of item (metadata)." +
                     "<br/>Valid values for &lt;item&gt; are CATALOGS, CUBES, DIMENSIONS, HIERARCHIES, MEASURES, MEMBERS, PROPERTIES and SETS." +
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
                "<br/>Refer to the MDX specification for more information about writing MDX queries." +
                "<br/>" +
                "<br/>Check out the tutorial here:" +
                "<br/>" + this.tutorialLine
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
              thead += "<th>" + escXml(member.Caption) + "</th>";
            });
            thead += "</tr>";
            i++;
          });
          thead += "</thead>";
          return thead;
      }

      function renderCells(axis) {
          var td = "";
          axis.eachTuple(function(){
              if (cellset.cellOrdinal() === cellIndex++ && cellset.cellValue) {
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
            tbody += "<th>" + escXml(member.Caption) + "</th>";
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
  handleExecute: function(){
    var me = this;
    var statement = me.statementLines.join("\n");
    statement = statement.substr(0, statement.lastIndexOf(";"));
    statement = statement.replace(/\xA0/g, " ");
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
        case "SHOW":
          me.handleShow();
          break;
        case "TEST":
          me.handleTest();
          break;
        case "USE":
          me.handleUse();
          break;
        case "HELP":
          me.handleHelp();
          break;
        default:
          me.error("Unrecognized command: " + token.text, true);
      }
    }
    catch (e) {
      me.error(typeof(e) === "string" ? e : e.getMessage(), true);
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
    var me = this;
    me.xmla.discoverDataSources({
      success: function(xmla, request, rowset){
        rowset.eachRow(function(row){
          me.writeResult("Connected to datasource " + row.DataSourceName + ".", "");
          me.xmlaRequest.properties.DataSourceInfo = row.DataSourceInfo;
          me.createLine();
          me.prompt = me.defaultPrompt;
          me.createLine("", me.prompt);
        });
      },
      error: function(){
        showAlert(
          "Error discovering datasources",
          "An error occurred when attempting to find XML/A datasources." + (typeof(top.pho) === "undefined" ? "" :
          "<br/>Verify that the \"EnableXmla\" data source parameter of your Analysis datasources is set to \"true\"." +
          //"<br/>You can edit data source parameters in the <a href=\"javascript:window.top.pho.showDatasourceManageDialog(window.top.datasourceEditorCallback)\">\"Manage Datasources\"</a> dialog." +
          "<br/>Alternatively, this error may be due to a misconfiguration of one of your mondrian schemas." +
          "<br/>See <a href=\"http://jira.pentaho.com/browse/MONDRIAN-1056\">http://jira.pentaho.com/browse/MONDRIAN-1056</a> for more details.")
        );
        me.createLine();
        me.prompt = me.defaultPrompt;
        me.createLine("", me.prompt);
      }
    });
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
          var base = location.origin + "/";
          //mondrian, f.e. http://localhost:8080/mondrian/xmla
          urls.push(base + "mondrian/xmla");
          //jasperreports, f.e. http://localhost:8080/jasperserver/xmla
          urls.push(base + "jasperserver/xmla");
          //icCube, f.e. http://localhost:8080/icCube/xmla
          urls.push(base + "icCube/xmla");
          //pentaho, f.e. http://localhost:8080/pentaho/Xmla
          urls.push(base + location.pathname.split("/")[1] + "/Xmla");
        }
        this.initDatasources(urls, 0);
        break;
      case 2:
        var urls = arguments[0], index = arguments[1];
        if (index >= urls.length) {
          showAlert(
            "Error discovering datasources",
            "Unable to find the XML/A service. Try specifying the URL of the XML/A service using the \"XmlaUrl\" URL query parameter."
          );
          return;
        }
        var me = this;
        this.xmla.discoverDataSources({
          url: urls[index],
          success: function(xmla, request, rowset){
            rowset.eachRow(function(row){
              me.writeResult("Connected to datasource " + row.DataSourceName + ".", "");
              me.xmlaRequest.properties.DataSourceInfo = row.DataSourceInfo;
              me.xmlaRequest.url = request.url
              me.createLine();
              me.prompt = me.defaultPrompt;
              me.createLine("", me.prompt);
            });
          },
          error: function(xmla, request){
            me.initDatasources(urls, ++index);
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
