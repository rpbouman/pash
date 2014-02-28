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
      if (!e) e = win.event;
      win.setTimeout(function(){
        me.keyDownHandler(e);
      }, 1)
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
        me.createLine(me.lines[i], "");
      }
    }
    me.createLine();
    me.updateCaretPosition();
    me.focus();
  },
  getLineBreak: function(interval) {
    return this.conf.lineBreak || Wsh.defaultConfig.lineBreak;
  },
  updateText: function(){
    var textarea = this.getTextArea();
    var text = textarea.value;
    text = text.replace(/\xA0/g, " ");
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
      textarea.value = line;
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
        textarea.value = this.oldValue;
      }
      textarea.disabled = false;
      textarea.focus();
      this.inputBlocked = false;
    }
  },
  keyDownHandler: function(e) {
    if (this.inputBlocked) return;
    this.fireEvent("keydown", e);
    var textarea = this.getTextArea();
    var text = textarea.value;
    var lineBreak = this.conf.lineBreak;
    var line = this.getCurrentLine();
    var keyCode = e.keyCode;
    switch (keyCode) {
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
        if (typeof(this.tabHandler) === "function") {
          this.tabHandler();
        }
      default:
        this.updateText();
        break;
    }
  },
  getCaretPosition: function () {
    var el = this.getTextArea();
    if (el.selectionStart) {
      return el.selectionStart;
    }
    else
    if (doc.selection) {
      var r = doc.selection.createRange();
      if (r == null) return 0;
      var re = el.createTextRange(), rc = re.duplicate();
      re.moveToBookmark(r.getBookmark());
      rc.setEndPoint('EndToStart', re);
      return rc.text.length;
    }
    return 0;
  },
  getDom: function() {
    return gEl(this.getId());
  },
  getTextArea: function() {
    return gEl(this.getTextAreaId());
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
  createLine: function(textString, promptString) {
    if (this.fireEvent("beforeCreateLine", {}) === false) return;
    var line = doc.createElement("DIV");
    line.className = Wsh.prefix + "-line";

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

    this.getTextArea().value = "";
    this.fireEvent("afterCreateLine", {
      dom: line
    });
    this.alignDom();
    this.updateCaretPosition();
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
    if (!line) line = this.getCurrentLine();
    var spans = line.getElementsByTagName("SPAN");
    return spans[1];
  },
  getLineTextString: function(line) {
    var text = this.getLineText(line);
    return text.textContent || prompt.innerText;
  },
  setLineText: function(string, line) {
    if (!line) line = this.getCurrentLine();
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
    var prompt = this.getLinePrompt();
    var caret = this.getCaret();
    caret.style.left = (prompt.offsetWidth + (caretPosition * caret.offsetWidth)) + "px";
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
  }
};
Wsh.id = 0;
Wsh.prefix = "wsh";
Wsh.defaultConfig = {
  lineBreak: /\r?\n/,
  prompt: "wsh&gt; ",
  caretInterval: 200
};

return exports.Wsh = Wsh;
})(typeof(exports) === "object" ? exports : window);