// Importa o módulo HTTP nativo do Node
const http = require('http');

// Cria o servidor
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Olá, mundo!');
});

// Define a porta (por exemplo, 3000)
const PORT = 3000;

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});