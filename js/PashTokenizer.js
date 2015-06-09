(function(exports) {

var PashTokenizer = function (){
  this.reset();
};

PashTokenizer.prototype = {
  //      1     2     34         5          678                9    10                     11           12                    13
  regex: /(\s+)|(\w+)|(("[^"]*")|('[^']*'))|(((\/\/|--)[^\n]*)|(\/\*([^\*]|\*[^\/])*\*\/))|(\[[^\]]+\])|([\.,\*\-\+\(\):<>=])|(;)/g,
  tokenTypes: {
    1: "whitespace",
    2: "identifier",
    3: "string",
    4: "double quoted string",
    5: "single quoted string",
    6: "comment",
    7: "comment line",
    8: false,
    9: "comment block",
    10: false,
    11: "square braces",
    12: "operator",
    13: "terminator"
  },
  reset: function(){
    if (this.tokens) this.tokens.length = 0;
    this.currentToken = -1;
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
  hasMoreTokens: function(){
    var tokens = this.tokens;
    if (!tokens) {
      return false;
    }
    var n = tokens.length, currentToken = this.currentToken;
    if (currentToken >= n) {
      return false;
    }
    for (i = currentToken; i < n; i++){
      if (this.isIgnoredToken(tokens[i])) {
        continue;
      }
      return true;
    }
    return false;
  },
  ignoredTokens: {
    whitespace: true,
    "comment line": true,
    "comment block": true
  },
  isIgnoredToken: function(type){
    if (type.type) {
      type = type.type;
    }
    return Boolean(this.ignoredTokens[type]);
  },
  nextToken: function(){
    var token = null;
    var ignoredTokens = this.ignoredTokens;
    while (this.hasMoreTokens()) {
      token = this.tokens[this.currentToken++];
      if (this.isIgnoredToken(token)) {
        token = null;
        continue;
      }
      break;
    }
    return token;
  }
};

exports.PashTokenizer = PashTokenizer;
})(typeof(exports) === "object" ? exports : window);
