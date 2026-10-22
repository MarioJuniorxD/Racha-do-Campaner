# Banco de dados

A primeira versão utiliza dados temporários no backend para facilitar o início do projeto.

A próxima etapa será criar SQLite com tabelas:

- usuarios
- jogadores
- jogos
- presencas
- pagamentos
- avisos

Relacionamentos principais:

usuario 1 --- 1 jogador
jogo 1 --- N presencas
jogador 1 --- N presencas
jogador 1 --- N pagamentos
