/**
 * Backup dos apps da EMFAL
 * Roda na conta da escola (emfal.ped@edu.pbh.gov.br).
 * Copia as planilhas dos apps para a pasta "Backup Apps EMFAL", numa subpasta com a data.
 * Guarda as 8 últimas cópias (cerca de 2 meses, se for semanal); as mais antigas vão para a lixeira.
 *
 * 1º uso: rode fazerBackup (autorize quando o Google pedir).
 * Depois: rode agendarSemanal uma vez para o backup acontecer sozinho toda sexta à noite.
 */
var PASTA_BACKUP = 'Backup Apps EMFAL';
var GUARDAR = 8;
// Planilhas cujo nome contém alguma destas palavras entram no backup
var PALAVRAS = ['Corretor', 'Relatórios', 'Relatorios', 'Ocorr', 'Prova', 'Currículo', 'Curriculo', 'Usuários', 'Usuarios', 'Substitui', 'Super App'];

function fazerBackup() {
  var raiz = pastaRaiz_();
  var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH-mm');
  var destino = raiz.createFolder(hoje);
  var copiadas = [];
  var it = DriveApp.searchFiles("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and 'me' in owners");
  while (it.hasNext()) {
    var f = it.next(), nome = f.getName();
    if (nome.indexOf('BACKUP') === 0) continue;
    if (!PALAVRAS.some(function (p) { return nome.indexOf(p) >= 0; })) continue;
    if (dentroDoBackup_(f, raiz)) continue;
    f.makeCopy(nome, destino);
    copiadas.push(nome);
  }
  limparAntigos_(raiz);
  Logger.log('Backup feito em "' + PASTA_BACKUP + '/' + hoje + '" com ' + copiadas.length + ' planilhas:\n- ' + copiadas.join('\n- '));
  return copiadas;
}

function agendarSemanal() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'fazerBackup') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('fazerBackup').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(22).create();
  Logger.log('Pronto: o backup vai rodar sozinho toda sexta-feira, por volta das 22h.');
}

function pastaRaiz_() {
  var it = DriveApp.getFoldersByName(PASTA_BACKUP);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_BACKUP);
}

function dentroDoBackup_(arquivo, raiz) {
  var pais = arquivo.getParents();
  while (pais.hasNext()) {
    var p = pais.next();
    if (p.getId() === raiz.getId()) return true;
    var avos = p.getParents();
    while (avos.hasNext()) if (avos.next().getId() === raiz.getId()) return true;
  }
  return false;
}

function limparAntigos_(raiz) {
  var pastas = [], it = raiz.getFolders();
  while (it.hasNext()) pastas.push(it.next());
  pastas.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
  pastas.slice(GUARDAR).forEach(function (p) { p.setTrashed(true); });
}
