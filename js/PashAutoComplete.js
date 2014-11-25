(function(exports) {

var PashAutoComplete = function(pash){
  this.pash = pash;
  pash.addListener("textChanged", this.textChanged, this);
  pash.addListener("caretPositionChanged", this.caretPositionChanged, this);
  this.createDom();
};

PashAutoComplete.prototype = {
  emptyList: [],
  commandList: [
    "HELP",
    "SELECT",
    "SHOW",
    "USE",
    "WITH"
  ],
  showCommandList: [
    "CATALOGS",
    "CUBES",
    "DIMENSIONS",
    "HIERARCHIES",
    "LEVELS",
    "MEASURES",
    "MEMBERS",
    "PROPERTIES"
  ],
  textChanged: function(source, event, data){
    var text = data.text;
    var position = data.position;

    var textAfter = text.substr(position);
    var currentWordPartAfter = /^(\w)*/g.exec(textAfter);
    if (currentWordPartAfter && currentWordPartAfter[1]) {
      currentWordPartAfter = currentWordPartAfter[1];
    }
    else {
      currentWordPartAfter = "";
    }

    var textTo = text.substr(0, position + currentWordPartAfter.length);
    var currentWord = /(\w+)$/g.exec(textTo);
    if (currentWord && currentWord[1]) {
      currentWord = currentWord[1];
    }
    else {
      currentWord = "";
    }

    if (currentWord === "") {
      var enteredText = pash.getEnteredStatementText() + "\n" + textTo;
      var list;
      if (enteredText === "") {
        list = this.commandList;
      }
      else {
        var firstWord = /^[^\w]*(\w+)\b/m;
        firstWord = firstWord.exec(enteredText);
        if (!firstWord) {
          firstWord = "";
        }
        else {
          firstWord = firstWord[1];
        }
        switch (firstWord.toUpperCase()) {
          case "HELP":
            list = this.commandList;
            break;
          case "SHOW":
            list = this.showCommandList;
            break;
          case "USE":
            break;
          case "SELECT":
          case "WITH":
            break;
        }
      }
      this.populateList(list);
    }
    else {
      this.filterList(currentWord);
    }
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
    for (i = 0; i < n; i++){
      item = items[i];
      word = item.innerHTML;
      if (word.toUpperCase().indexOf(matchPrefix) === 0) {
        display = "";
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
