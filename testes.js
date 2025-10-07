const express = require('express');
const app = express();
app.use(express.json()); // para receber JSON no body

app.get('/retornar/:texto', (req, res) => {
  const texto = req.params.texto;
  res.send(`Você enviou: ${texto}`);
});

app.get('/', (req, res) => {
  res.send('Olá, mundo!');
});


app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));
