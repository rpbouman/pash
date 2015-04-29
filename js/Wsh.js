(function(exports) {

var win = window,
    doc = document,
    body = doc.body
;

function gEl(id) {
  return doc.getElementById(id);
}

var Wsh;
(Wsh = function(conf) {
  this.lineId = 0;
  this.init(conf || {});
}).prototype = {
  init: function(conf) {
    this.conf = conf || {};
    var prop, defaultConfig = Wsh.defaultConfig;
    for (prop in defaultConfig) {
      if (typeof(this.conf[prop]) === "undefined") {
        this.conf[prop] = defaultConfig[prop];
      }
    }
    this.id = this.conf.id || (Wsh.prefix + (++Wsh.id));
    this.listeners = {};
    if (this.conf.listeners) this.addListener(this.conf.listeners);
  },
  addListener: function(event, handler, scope) {
    if (arguments.length === 1) {
      if (event.constructor === Array) {
        var i, n = event.length;
        for (i = 0; i < n; i++) this.addListener(event[i]);
        return;
      }
      else
      if (typeof(event) === "object") {
        if (typeof(event.event) === "undefined") {
          var name, listener;
          for (name in event) {
            listener = event[name];
            switch (typeof(listener)) {
              case "function":
                this.addListener(name, listener);
                break;
              case "object":
                this.addListener(name, listener.handler, listener.scope);
                break;
            }
          }
          return;
        }
        else {
          handler = event.handler;
          scope = event.scope;
          event = event.event;
        }
      }
    }
    var handlers = this.listeners[event];
    if (typeof(handlers) === "undefined") {
      handlers = this.listeners[event] = [];
    }
    handlers.push({
      handler: handler,
      scope: scope || this
    });
  },
  fireEvent: function(event, data) {
    var listeners = this.listeners[event];
    if (typeof(listeners) === "undefined") return;
    var n = listeners.length, listener;
    for (i = 0; i < n; i++) {
      listener = listeners[i];
      if (listener.handler.call(
        listener.scope,
        this, event, data
      ) === false) {
        return false;
      }
    }
    return true;
  },
  getId: function() {
    return this.id;
  },
  getTextAreaId: function() {
    return this.getId() + "-textarea";
  },
  getCaretId: function() {
    return this.getId() + "-caret";
  },
  getContainer: function() {
    return this.conf.container || body;
  },
  getCaret: function() {
    return gEl(this.getCaretId());
  },
  initCaretInterval: function(interval) {
    var me = this;
    if (!interval) interval = this.getCaretInterval();
    if (me.caretIntervalId) win.clearInterval(me.caretIntervalId);
    this.caretIntervalId = win.setInterval(function(){
      var caret = me.getCaret();
      caret.style.visibility = caret.style.visibility==="hidden" ? "" : "hidden";
    }, interval);
  },
  setCaretInterval: function(interval) {
    this.initCaretInterval(interval);
    this.caretInterval = interval;
  },
  getCaretInterval: function() {
    return (this.caretInterval || this.conf.caretInterval || Wsh.defaultConfig.caretInterval);
  },
  render: function() {
    var me = this;
    var id = me.getId();
    var dom = doc.createElement("DIV");
    dom.className = Wsh.prefix;
    dom.id = id;
    dom.onclick = function() {
      me.focus();
    }

    var textarea = doc.createElement("TEXTAREA");
    textarea.className = Wsh.prefix + "-textarea";
    textarea.id = me.getTextAreaId();
    textarea.onkeydown = function(e) {
      var textarea = me.getTextArea();
      if (!e) {
        e = win.event;
      }
      win.setTimeout(function(){
        me.keyDownHandler(e);
      }, 0);
    }
    dom.appendChild(textarea);

    var caret = doc.createElement("SPAN");
    caret.className = Wsh.prefix + "-caret";
    caret.id = me.getCaretId();
    dom.appendChild(caret);
    this.initCaretInterval();

    var container = me.getContainer();
    container.appendChild(dom);
    if (me.lines){
      for (var i = 0; i < me.lines.length; i++) {
        me.createLine(me.lines[i], "", "init");
      }
    }
    this.fireEvent("rendered", this);
    me.createLine();
    me.updateCaretPosition();
    me.focus();
  },
  getLineBreak: function(interval) {
    return this.conf.lineBreak || Wsh.defaultConfig.lineBreak;
  },
  replaceNbsp: function(text) {
    return text.replace(/\xA0/g, " ");
  },
  updateText: function(){
    var textarea = this.getTextArea();
    var text = textarea.value;
    text = this.replaceNbsp(text);
    var lineBreak = this.conf.lineBreak;
    var line;
    if (lineBreak.test(text)) {
      var lines = text.split(lineBreak);
      var i, n = lines.length;
      for (i = 0; i < n; i++){
        line = lines[i];
        this.setLineText(line);
        if (i < n-1) {
          this.fireEvent("leaveLine", {
            dom: this.getCurrentLine(),
            string: line
          });
          this.createLine();
        }
      }
      this.setTextAreaText(line);
      this.updateCaretPosition();
    }
    else {
      line = this.getCurrentLine();
      this.setLineText(textarea.value, line);
    }
    this.updateCaretPosition();
  },
  blockInput: function(blocked){
    var textarea = this.getTextArea();
    if (blocked) {
      var text = textarea.value;
      textarea.blur();
      textarea.disabled = true;
      this.oldValue = text;
      this.inputBlocked = true;
    }
    else {
      if (typeof(this.oldValue) === "string") {
        this.setTextAreaText(this.oldValue);
      }
      textarea.disabled = false;
      textarea.focus();
      this.inputBlocked = false;
    }
  },
  keyDownHandler: function(e) {
    if (this.inputBlocked) {
      return;
    }
    if (this.fireEvent("keydown", e) === false) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      else {
        e.returnValue = false;
      }
      return;
    }
    var textarea = this.getTextArea();
    var text = textarea.value;
    var lineBreak = this.conf.lineBreak;
    var line = this.getCurrentLine();
    var keyCode = e.keyCode;
    switch (keyCode) {
      case 16:  //shift
      case 33:  //page up
      case 34:  //page down
      case 38:  //arrow up
      case 40:  //arrow down
        this.restoreCaretPosition();
        return;
      case 13:
        var string = text.replace(lineBreak, "");
        this.setLineText(string, line);
        this.fireEvent("leaveLine", {
          dom: line,
          string: string
        });
        this.createLine();
        break;
      case 9:
        this.focus();
      default:
        this.updateText();
        break;
    }
    this.fireEvent("textChanged", {
      text: textarea.value,
      position: this.getCaretPosition(),
      keyCode: keyCode
    });
  },
  getCaretPosition: function () {
    var el = this.getTextArea();
    if (el.selectionStart) {
      return el.selectionStart;
    }
    else
    if (doc.selection) {
      var r = doc.selection.createRange();
      if (r == null) {
        return 0;
      }
      var re = el.createTextRange(), rc = re.duplicate();
      re.moveToBookmark(r.getBookmark());
      rc.setEndPoint('EndToStart', re);
      return rc.text.length;
    }
    return 0;
  },
  restoreCaretPosition: function(){
    this.setCaretPosition(this.prevCaretPosition);
  },
  setCaretPosition: function(position){
    var el = this.getTextArea();
    if (el.setSelectionRange) {
      el.setSelectionRange(position, position);
    }
    else
    if (el.createTextRange) {
      var range = el.createTextRange();
      range.collapse(true);
      range.moveStart("character", position);
      range.moveEnd("character", position);
      range.select();
    }
    this.updateCaretPosition();
  },
  getDom: function() {
    return gEl(this.getId());
  },
  getTextArea: function() {
    return gEl(this.getTextAreaId());
  },
  setTextAreaText: function(text){
    this.getTextArea().value = text;
  },
  getTextAreaText: function() {
    return this.getTextArea().value;
  },
  focus: function() {
    if (this.fireEvent("beforeFocus", {}) === false) return;
    this.getTextArea().focus();
    this.fireEvent("afterFocus", {});
  },
  escapeHTML: function(string){
    return string.replace("&", "&amp;").replace(">", "&gt;").replace("<", "&lt;");
  },
  createLine: function(textString, promptString, className) {
    var cls = Wsh.prefix + "-line";
    var id = cls + (++this.lineId);
    if (this.fireEvent("beforeCreateLine", {
      id: id
    }) === false) return;
    var line = doc.createElement("DIV");
    line.id = id;
    if (className){
      cls += " " + className;
    }
    line.className = cls;

    var prompt = doc.createElement("SPAN");
    prompt.className = Wsh.prefix + "-prompt";
    if (typeof(promptString) === "undefined") {
      promptString =  typeof(this.prompt)==="string" ?  this.prompt : (typeof(this.conf.prompt) === "string" ? this.conf.prompt : Wsh.defaultConfig.prompt);
    }
    prompt.innerHTML = promptString;
    line.appendChild(prompt);

    var text = doc.createElement("SPAN");
    if (typeof(textString) !== "undefined") {
      text.innerHTML = this.escapeHTML(textString);
    }
    text.className = Wsh.prefix + "-text";
    line.appendChild(text);

    var caret = this.getCaret();
    line.appendChild(caret);

    var dom = this.getDom();
    dom.appendChild(line);

    this.setTextAreaText("");
    this.fireEvent("afterCreateLine", {
      id: id,
      dom: line
    });
    this.alignDom();
    this.updateCaretPosition();
    this.currentLine = line;
    return line;
  },
  alignDom: function(){
    var dom = this.getDom();
    dom.scrollLeft = 0;
    if (dom.scrollHeight > dom.clientHeight) {
      dom.scrollTop = (dom.scrollHeight - dom.clientHeight);
    }
    this.updateCaretPosition();
  },
  getLines: function() {
    return this.getDom().getElementsByTagName("DIV");
  },
  getLine: function(index) {
    var lines = this.getLines();
    return lines[index];
  },
  getCurrentLine: function() {
    if (this.currentLine) {
      return this.currentLine;
    }
    var lines = this.getLines();
    return lines[lines.length - 1];
  },
  getLinePrompt: function(line) {
    if (!line) line = this.getCurrentLine();
    var spans = line.getElementsByTagName("SPAN");
    return spans[0];
  },
  getLinePromptString: function(line) {
    var prompt = this.getLinePrompt(line);
    return prompt.textContent || prompt.innerText;
  },
  setLinePrompt: function(string, line) {
    var prompt = this.getLinePrompt(line);
    prompt.innerHTML = string;
  },
  getLineText: function(line) {
    if (!line) {
      line = this.getCurrentLine();
    }
    var spans = line.getElementsByTagName("SPAN");
    return spans[1];
  },
  getLineTextString: function(line) {
    var text = this.getLineText(line);
    return text.textContent || text.innerText;
  },
  setLineText: function(string, line) {
    if (!line) {
      line = this.getCurrentLine();
    }
    this.lineContent = this.escapeHTML(string);
    this.fireEvent("beforeSetLineText", {
      dom: line,
      string: string
    });
    var text = this.getLineText(line);
    text.innerHTML = this.lineContent;
    this.updateCaretPosition();
    this.fireEvent("afterSetLineText", {
      dom: line,
      string: string
    });
  },
  updateCaretPosition: function() {
    var caretPosition = this.getCaretPosition();
    this.prevCaretPosition = caretPosition;
    var prompt = this.getLinePrompt();
    var caret = this.getCaret();
    var line = this.getCurrentLine();
    var text = line.getElementsByTagName("SPAN")[1];
    var str = text.textContent || text.innerText || "";
    var head = str.substr(0, caretPosition);
    var tail = str.substr(caretPosition);
    text.innerHTML = this.escapeHTML(head);
    caret.style.left = text.offsetLeft + text.offsetWidth + "px";
    caret.style.top = "0px";
    text.innerHTML = this.escapeHTML(str);

    var textArea = this.getTextArea();
    var style = textArea.style;
    style.top = (caret.parentNode.offsetTop + caret.parentNode.clientHeight) + "px";
    //style.top = dom.scrollHeight + "px";
    var dom = this.getDom();
    //style.top = (dom.clientHeight < dom.scrollHeight ? dom.clientHeight : caret.parentNode.offsetTop) + "px";
    //style.top = (dom.scrollHeight + dom.clientHeight) + "px";
    style.left = (caret.offsetLeft + caret.clientWidth) + "px";
    //textArea.scrollIntoView(true);
    textArea.focus();
    this.fireEvent("caretPositionChanged", caret);
  }
};
Wsh.id = 0;
Wsh.prefix = "wsh";
Wsh.defaultConfig = {
  lineBreak: /\r?\n/,
  prompt: "wsh&gt; ",
  caretInterval: 200
};

var WshHistory;
WshHistory = function(wsh){
  wsh.addListener("keydown", this.keyDown, this);
  this.index = 0;
};

WshHistory.prototype = {
  keyDown: function(wsh, name, event){
    var keyCode = event.keyCode;
    var i = 0, l = 0, idx, oldIndex = this.index;
    switch (keyCode) {
      case 38:  //up arrow
        this.index++;
        break;
      case 40:  //down arrow
        if (this.index) {
          this.index--;
          l = 1;
        }
        break;
      case 13:
        this.index = 0;
      default:
        return;
    }
    var lines = wsh.getLines(), line, text, texts = {};
    while (this.index > i) {
      while (true) {
        ++l;
        idx = lines.length - l;
        if (idx < 0) {
          this.index = oldIndex;
          return;
        };
        line = lines[idx];
        if (line.className !== "wsh-line") {
          continue;
        }
        text = wsh.getLineTextString(line);
        if (text === "") {
          continue;
        }
        if (texts[text]) {
          continue;
        }
        texts[text] = true;
        break;
      };
      i++;
    }
    if (!line) {
      this.index = oldIndex;
    }
    text = wsh.getLineTextString(line);
    wsh.setTextAreaText(text);
    wsh.updateText();
  }
};

exports.WshHistory = WshHistory;

return exports.Wsh = Wsh;
})(typeof(exports) === "object" ? exports : window);
