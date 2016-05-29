var pash = new Pash({
  caretInterval: 500,
  extraCommands: ["CONNECT"],
  appTitle: "MDX Shell for Chrome - Free trial",
  maxStatementLength: 512
});
var pashAutoComplete = new PashAutoComplete(pash);
var pashHistory = new WshHistory(pash);
