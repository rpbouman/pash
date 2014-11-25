(function(exports) {

var Xmlash = function(conf){
  Wsh.apply(this, arguments);
  this.tokenizer = new exports.PashTokenizer();
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
  ];
  this.addListener("leaveLine", this.leaveLineHandler, this);
  this.history = new exports.WshHistory(this);
  this.render();
  this.handleHelp();
  this.initDatasources();
};
xmlashPrototype = {
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
      this.prompt = "pash> ";
      if (afterTerminator) {
        this.fireEvent("error");
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
          tokenType === "single quoted string"
        )
    ) {
      token.type = "identifier";
      token.text = token.text.substr(1, token.text.length - 2);
    }
    if (!token || tokenType !== "identifier") {
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
              if (exports.levenstein(c1, c2) < 5) {
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
    var me = this, tokenizer = me.tokenizer, token, func;
    var keywords = {
      CATALOGS: "discoverDBCatalogs",
      CUBES: "discoverMDCubes",
      DIMENSIONS: "discoverMDDimensions",
      HIERARCHIES: "discoverMDHierarchies",
      LEVELS: "discoverMDLevels",
      MEASURES: "discoverMDMeasures",
      MEMBERS: "discoverMDMembers",
      PROPERTIES: "discoverMDProperties"
    };
    if (!tokenizer.hasMoreTokens() || typeof(func = keywords[(token = tokenizer.nextToken()).text.toUpperCase()])!=="string") {

      this.error(
        "<br/>Unrecognized command argument \"" + token.text + "\"" +
        "<br/>Expected one of the following instead: CATALOGS, CUBES, DIMENSIONS, HIERARCHIES, LEVELS, MEASURES, MEMBERS, PROPERTIES.",
        true
      );
      return;
    }
    if (tokenizer.hasMoreTokens()) {
      this.error("Extra token \"" + tokenizer.nextToken().text + "\" appearing after command argument", true);
      return;
    }
    var catalog, request = this.xmlaRequest;
    if (func === "discoverDBCatalogs") {
      var catalog = request.properties.Catalog;
      request.callback = function(){
        request.properties.Catalog = catalog;
        delete request.callback;
      }
      delete request.properties.Catalog;
    }
    else {
      if (typeof(request.properties) === "undefined") {
        request.properties = {};
      }
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
                     "<br/>Valid values for &lt;item&gt; are CATALOGS, CUBES, DIMENSIONS, HIERARCHIES, MEASURES, MEMBERS and PROPERTIES." +
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
          var i = 0;
          axis.eachHierarchy(function(hierarchy){
            thead += "<tr>";
            if (!i && dataset.hasRowAxis()) {
              var rowSpan = axis.hierarchyCount();
              var rowAxis = dataset.getRowAxis();
              var colSpan = rowAxis.hierarchyCount();
              thead += "<td rowspan=\"" + rowSpan + "\" colspan=\"" + colSpan + "\"><br/></td>";
            }
            axis.eachTuple(function(tuple){
              var member = tuple.members[i];
              thead += "<th>" + member.Caption + "</th>";
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
            tbody += "<th>" + member.Caption + "</th>";
            i++;
          });
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
    if (!token) return;
    switch (token.text.toUpperCase()) {
      case "SELECT":
      case "WITH":
        me.handleExecute();
        break;
      case "SHOW":
        me.handleShow();
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
          this.prompt = "pash> ";
          me.createLine("", this.prompt);
        });
      },
      error: function(){
        window.parent.mantle_showMessage(
          "Error discovering datasources",
          "An error occurred when attempting to find XML/A datasources." +
          "<br/>Verify that the \"EnableXmla\" data source parameter of your Analysis datasources is set to \"true\"." +
          //"<br/>You can edit data source parameters in the <a href=\"javascript:window.top.pho.showDatasourceManageDialog(window.top.datasourceEditorCallback)\">\"Manage Datasources\"</a> dialog." +
          "<br/>Alternatively, this error may be due to a misconfiguration of one of your mondrian schemas." +
          "<br/>See <a href=\"http://jira.pentaho.com/browse/MONDRIAN-1056\">http://jira.pentaho.com/browse/MONDRIAN-1056</a> for more details."
        );
        me.createLine();
        this.prompt = "pash> ";
        me.createLine("", this.prompt);
      }
    });
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
