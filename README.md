# EMFAL — Super App

Um ícone e um login para os apps da Escola Municipal Francisca Alves (EMFAL).

- Entra uma vez com o usuário e a senha do Corretor EMFAL e já fica conectado em todos os módulos: Corretor, Prova Online, Relatórios, Currículo em Ação e Ocorrências.
- Servidor único: Corretor, Prova Online, Ocorrências, Relatórios e Currículo em Ação respondem pelo mesmo Apps Script (o do Corretor). Ocorrências, Relatórios e Currículo ficam no arquivo `EMFAL.gs` desse projeto, cada um isolado (funções chamadas como `oc.`, `rel.` e `cur.`). Os dados continuam nas mesmas planilhas, no Google Drive.
- Fica conectado: a sessão vale 365 dias. Na entrada, "Manter conectado neste aparelho" vem marcado; desmarcado (tablet ou computador da escola), a conta sai sozinha depois de 12 horas.
- As telas de cada módulo ainda são as de cada app, abertas dentro do super app.
- Ocorrências: todos os professores, em qualquer turma. Os demais módulos seguem as permissões de cada app (professor vê só as suas turmas; coordenação vê tudo).
- "Sou estudante: fazer prova" abre a tela do aluno da Prova Online, sem login de professor.
- Instalável no celular (PWA): no Chrome, menu ⋮ › Instalar app / Adicionar à tela inicial.

Endereço: https://emfalped-source.github.io/emfal/

## Autoria e direitos

© 2026 Pedro Ricardo Motta Mattos Fernandez (@pedror_motta). Todos os direitos reservados — ver [LICENSE](LICENSE).
O código está público só porque o GitHub Pages exige; isso não autoriza cópia nem reuso fora da EMFAL.
