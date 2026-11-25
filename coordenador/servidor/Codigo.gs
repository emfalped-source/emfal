/**
 * Coordenador Virtual — servidor (Google Apps Script)
 * Uso pessoal do coordenador. Os dados ficam numa planilha no Drive da conta que publica este script.
 *
 * Instalação (uma vez):
 * 1. Rode a função "instalar" e autorize quando o Google pedir.
 *    Ela cria a planilha "Coordenador Virtual — dados" no seu Drive.
 * 2. Na linha SENHA_INICIAL abaixo, troque o texto pela senha que você quer usar e rode "definirSenha".
 *    Depois volte a linha para 'troque-esta-senha' e salve: a senha fica guardada só como código embaralhado
 *    (hash) nas propriedades do script, nunca no código.
 * 3. Implantar > Nova implantação > App da Web: Executar como "Eu"; Quem pode acessar "Qualquer pessoa".
 *    Copie o endereço que termina em /exec.
 */
var SENHA_INICIAL = 'troque-esta-senha';
var NOME_PLANILHA = 'Coordenador Virtual — dados';
var DIAS_SESSAO = 365;

// ---------- instalação ----------
function instalar() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('PLANILHA');
  if (id) { try { SpreadsheetApp.openById(id); Logger.log('Já instalado: ' + SpreadsheetApp.openById(id).getUrl()); return; } catch (e) {} }
  var ss = SpreadsheetApp.create(NOME_PLANILHA);
  var c = ss.getSheets()[0]; c.setName('Contatos');
  c.getRange(1, 1, 1, 6).setValues([['id', 'nome', 'turma', 'responsavel', 'contatos', 'tratamento']]);
  var k = ss.insertSheet('Casos');
  k.getRange(1, 1, 1, 13).setValues([['id', 'data', 'estudante_id', 'estudante', 'turma', 'tipo', 'situacao', 'nivel', 'canal', 'decisao', 'detalhes', 'mensagem', 'registrado_em']]);
  [c, k].forEach(function (s) { s.setFrozenRows(1); s.getRange('1:1').setFontWeight('bold'); });
  p.setProperty('PLANILHA', ss.getId());
  Logger.log('Planilha criada: ' + ss.getUrl());
}

function definirSenha() {
  if (!SENHA_INICIAL || SENHA_INICIAL === 'troque-esta-senha') throw new Error('Troque o texto de SENHA_INICIAL antes de rodar.');
  var sal = Utilities.getUuid();
  var p = PropertiesService.getScriptProperties();
  p.setProperty('SAL', sal);
  p.setProperty('SENHA', hash_(SENHA_INICIAL, sal));
  p.deleteProperty('SESSOES');
  Logger.log('Senha definida. Agora apague a senha da linha SENHA_INICIAL e salve.');
}

// ---------- web ----------
function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var fn = API[req.fn];
    if (!fn) throw new Error('Função desconhecida.');
    out = { ok: true, res: fn.apply(null, req.args || []) };
  } catch (err) {
    out = { ok: false, erro: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return ContentService.createTextOutput('Coordenador Virtual: servidor no ar.'); }

var API = {
  entrar: function (senha) {
    var p = PropertiesService.getScriptProperties();
    Utilities.sleep(400); // freia tentativas em série
    if (!p.getProperty('SENHA')) throw new Error('Servidor sem senha definida. Rode "definirSenha" no Apps Script.');
    if (hash_(String(senha || ''), p.getProperty('SAL')) !== p.getProperty('SENHA')) throw new Error('Senha incorreta.');
    var tk = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
    var s = sessoes_(); s[hash_(tk, 'tk')] = Date.now() + DIAS_SESSAO * 864e5;
    gravarSessoes_(s);
    return { token: tk };
  },
  sair: function (tk) { var s = sessoes_(); delete s[hash_(String(tk), 'tk')]; gravarSessoes_(s); return true; },
  carregar: function (tk) {
    exigir_(tk);
    return { alunos: lerAlunos_(), casos: lerCasos_() };
  },
  salvarAlunos: function (tk, lista) {
    exigir_(tk);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var sh = aba_('Contatos');
      var trat = {}; lerAlunos_().forEach(function (a) { if (a.g) trat[a.id] = a.g; });
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
      var rows = (lista || []).map(function (a) { return linhaAluno_(a, a.g || trat[a.id] || ''); });
      if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
      return rows.length;
    } finally { lock.releaseLock(); }
  },
  salvarAluno: function (tk, a) {
    exigir_(tk);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var sh = aba_('Contatos'), r = acharLinha_(sh, a.id), row = [linhaAluno_(a, a.g || '')];
      if (r) sh.getRange(r, 1, 1, 6).setValues(row); else sh.appendRow(row[0]);
      return true;
    } finally { lock.releaseLock(); }
  },
  salvarCaso: function (tk, c) {
    exigir_(tk);
    var sh = aba_('Casos');
    sh.appendRow([c.id, c.data, c.aid, c.nome, c.turma, c.cat, c.sub, c.nivel, c.canal, c.dec, c.det || '', c.msg || '', new Date()]);
    return true;
  },
  apagarCaso: function (tk, id) {
    exigir_(tk);
    var sh = aba_('Casos'), r = acharLinha_(sh, id);
    if (r) sh.deleteRow(r);
    return true;
  }
};

// ---------- dados ----------
function planilha_() {
  var id = PropertiesService.getScriptProperties().getProperty('PLANILHA');
  if (!id) throw new Error('Servidor não instalado. Rode "instalar" no Apps Script.');
  return SpreadsheetApp.openById(id);
}
function aba_(n) { return planilha_().getSheetByName(n); }
function linhaAluno_(a, g) {
  return [String(a.id), String(a.nome || ''), String(a.turma || ''), String(a.resp || ''), JSON.stringify(a.cont || []), g || ''];
}
function lerAlunos_() {
  var sh = aba_('Contatos'), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 6).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    var cont = []; try { cont = JSON.parse(r[4] || '[]'); } catch (e) {}
    var a = { id: String(r[0]), nome: r[1], turma: r[2], resp: r[3], cont: cont, tels: cont.map(function (c) { return c.tel; }) };
    if (r[5]) a.g = r[5];
    return a;
  });
}
function lerCasos_() {
  var sh = aba_('Casos'), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var ini = Math.max(2, sh.getLastRow() - 999);
  return sh.getRange(ini, 1, sh.getLastRow() - ini + 1, 12).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return { id: String(r[0]), data: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), aid: String(r[2]), nome: r[3], turma: r[4], cat: r[5], sub: r[6], nivel: Number(r[7]), canal: r[8], dec: r[9], det: r[10], msg: r[11] };
  }).reverse();
}
function acharLinha_(sh, id) {
  var n = sh.getLastRow() - 1; if (n < 1) return 0;
  var f = sh.getRange(2, 1, n, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return f ? f.getRow() : 0;
}

// ---------- segurança ----------
function hash_(txt, sal) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + txt, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function sessoes_() {
  var s = {}; try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('SESSOES') || '{}'); } catch (e) {}
  var agora = Date.now(); Object.keys(s).forEach(function (k) { if (s[k] < agora) delete s[k]; });
  return s;
}
function gravarSessoes_(s) { PropertiesService.getScriptProperties().setProperty('SESSOES', JSON.stringify(s)); }
function exigir_(tk) {
  var s = sessoes_();
  if (!tk || !s[hash_(String(tk), 'tk')]) throw new Error('SESSAO: Sessão expirada. Entre de novo.');
}
