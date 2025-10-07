import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import fs from "fs";

import {
  cadastrarConta /*POST*/,
  loginConta /*POST*/,
  logoutConta /*POST*/,
  atualizarRefreshToken /*fn*/,
  carregarPerfil /*POST*/
} from "./contas.js";
import {
  verificarPedido_fn /*fn*/,
  reservarPedido_fn /*fn*/,
  cancelarPedido /*POST*/,
  pagarPixPedido /*POST*/,
  atualizarCredenciaisPix /*fn*/,
  testeFinalizarPedido /*POST*/,
  verificarValidadePedido /*GET*/,
  atualizarPedido /*POST*/,
  verificarPagamentoPedido /*POST*/,
  verificarStatusPedido /*POST*/
} from "./pedidos.js";
import { 
  carregarEvento /*GET*/,
  carregarItens /*GET*/,
  inserirItem /*fn*/,
  lerItens /*fn*/
} from "./eventos.js";

const PORT = 4000;

const app = express();
app.use(cors()); //para permitir acesso de qualquer origem
app.use(express.json()); //para interpretar JSON no body das requisições
app.set('trust proxy', true); //para obter IP de quem acessa

// Pool para EVENTOS
export const poolEventos = mysql.createPool({
  host: "localhost",
  user: "root",/*
  password: "PlasmaTech2.07",*/
  database: "bitevento",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50
});

// Pool para PEDIDOS
export const poolPedidos = mysql.createPool({
  host: "localhost",
  user: "root",/*
  password: "PlasmaTech2.07",*/
  database: "bitevento",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50
});

// Pool para CONTAS
export const poolContas = mysql.createPool({
  host: "localhost",
  user: "root",/*
  password: "PlasmaTech2.07",*/
  database: "bitevento",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50
});

// Pool para RESERVAS
export const poolReservas = mysql.createPool({
  host: "localhost",
  user: "root",/*
  password: "PlasmaTech2.07",*/
  database: "bitevento",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50
});

// Pool para UNIQUE ITENS
export const poolUniqueItens = mysql.createPool({
  host: "localhost",
  user: "root",/*
  password: "PlasmaTech2.07",*/
  database: "bitevento",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50
});

process.on('SIGINT', async () => {
  await poolEventos.end();
  await poolPedidos.end();
  await poolContas.end();
  await poolReservas.end();
  await poolUniqueItens.end();
  process.exit();
});

// A ORDEM DE DECLARAÇÃO DAS ROTAS IMPORTA!
// A ORDEM DE DECLARAÇÃO DAS ROTAS IMPORTA!
// A ORDEM DE DECLARAÇÃO DAS ROTAS IMPORTA!
// A ORDEM DE DECLARAÇÃO DAS ROTAS IMPORTA!

//COMPUTAR TEMPO E USO DE CPU + SALVAR LOG
app.use((req, res, next) => {
  req._startTime = Date.now();
  req._startCPU = process.cpuUsage();

  // Função auxiliar para limitar tamanho do log
  const limitSize = (data) => {
    if (data === undefined || data === null) return null;
    const str = typeof data === "string" ? data : JSON.stringify(data);
    if (str.length > 10240) {
      return str.slice(0, 10240) + "...[TRUNCADO]";
    }
    return str;
  };

  const requestData = {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: limitSize(req.body),
    params: req.params,
    query: req.query,
    ip: req.ip,
  };

  // Interceptar body da resposta
  let responseBody;
  const originalJson = res.json;
  res.json = function (body) {
    responseBody = limitSize(body);
    return originalJson.call(this, body);
  };

  const originalSend = res.send;
  res.send = function (body) {
    responseBody = limitSize(body);
    return originalSend.call(this, body);
  };

  res.on("finish", () => {
    const duration = Date.now() - req._startTime;
    const cpu = process.cpuUsage(req._startCPU);

    const responseData = {
      statusCode: res.statusCode,
      durationMs: duration,
      cpuMs: {
        total: (cpu.user + cpu.system) / 1000,
        user: cpu.user / 1000,
        system: cpu.system / 1000,
      },
      body: responseBody,
    };

    const logEntry = {
      timestamp: new Date().toISOString(),
      request: requestData,
      response: responseData,
    };

    // 💡 Mostra no terminal
    console.log(
      `[${logEntry.timestamp}] ${req.method} ${req.originalUrl} ` +
        `→ ${res.statusCode} | ${duration}ms | CPU: total  ${responseData.cpuMs.total}ms, user ${responseData.cpuMs.user}ms, system ${responseData.cpuMs.system}ms`
    );

    // 💾 Salva em arquivo
    fs.appendFile("requests.log", JSON.stringify(logEntry) + "\n", (err) => {
      if (err) console.error("Erro ao salvar log:", err);
    });
  });

  next();
});

//EVENTOS
app.get("/carregarevento/:eid", carregarEvento);
app.get("/carregaritens/:eid", carregarItens);

//CONTAS
app.post("/testecadastro", cadastrarConta);
app.post("/testelogin", loginConta);
app.get("/testeperfil", carregarPerfil);

//PEDIDOS
//app.post("/pagarpixpedido/:pedidoid/:eid", pagarPixPedido);
/**
 * Com Pix, ao clicar em "Gerar Pix" na tela inicial:
 *    > reservarpedido (se erro, tela de Resumo do pedido atualizado) + pagarpedido (Pix, se ok)
 * 
 * Com Cartão, ao preencher dados adicionais e clicar em Continuar:
 *    > reservar pedido
 * Ao clicar em em "Pagar agora" na tela de Resumo do pedido:
 *    > pagarpedido (cartão)
 * 
 * Com Boleto, ao preencher dados adicionais e clicar em Continuar:
 *    > reservarpedido (se erro, retorna para tela de Resumo do pedido atualizado)
 * Ao clicar em "Gerar Boleto" na tela de Resumo do pedido:
 *    > pagarpedido (boleto)
 */

// !!! EM TODOS OS CASOS:
/*
    > pedidoId na URL
    > no header, enviar o id do evento + password do pedido + cookie da sessao (se aplicavel)
    > no body, enviar os dados adicionais (se aplicavel; ex: reservarpedido)
*/

/*NOVO: app.post("/reservarpedido", ?); */
//  > no header, enviar eventoId
//  > no body, enviar dados do pedido (retorna pedido total ou parcial + password)

/*NOVO: app.get("/pagarpedido/:pedidoid", ?); */
//  > no header, enviar eventoId + password do pedido

/*NOVO: app.get("/carregarpedido/:pedidoid", ?); */
//  > no header, enviar eventoId + password do pedido + cookie da sessao (se pedido com conta)
//  > retorna dados do pedido (resumo, valores, uniqueItens, status, datas, etc)

app.post("/verificarstatuspedido/:pedidoid", verificarStatusPedido);
//mudar para GET, ler abaixo
//JUNTAR verificarstatuspedido + verificarpagamentopedido EM verificarpedido (GET + header)
//ao clicar em "Verificar manualmente", acessa a API Efi e coloca um backoff de >=30s
//!!! AO RETORNAR VERIFICADO E PAGO COM SUCESSO, CHAMAR carregarpedido
app.post("/verificarpagamentopedido/:pedidoid", verificarPagamentoPedido);
//mudar para GET, ler abaixo
//JUNTAR verificarstatuspedido + verificarpagamentopedido EM verificarpedido (GET + header)
//ao clicar em "Verificar manualmente", acessa a API Efi e coloca um backoff de >=30s
//!!! AO RETORNAR VERIFICADO E PAGO COM SUCESSO, CHAMAR carregarpedido

app.post("/atualizarpedido/:pedidoid", atualizarPedido); //mudar para PUT
//mudar para PUT
// > não terá "finalizarpedido", é chamado "atualizarpedido" que decide se irá finalizar ou cancelar

app.post("/cancelarpedido/:pedidoid", cancelarPedido); //mudar para PUT
//mudar para PUT

// Adicione este middleware logo após o uso do body-parser
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // JSON inválido
    return res.status(400).json({ msg: "JSON malformado ou inválido." });
  }
  next(err);
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada ou método inválido.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`O servidor está rodando na porta ${PORT}`);
  watchdog(atualizarCredenciaisPix, 60); // inicia o loop ao subir o servidor //() => atualizarCredenciaisPix(false)
});

async function watchdog(fn, intervaloSeg = 60) {
  while (true) {
    try {
      const nomeFn = fn.name || 'função anônima';
      console.log('Iniciando execução periódica:', nomeFn);
      await fn();
    } catch (e) {
      console.error('Erro na execução periódica:', e);
    }
    await new Promise(resolve => setTimeout(resolve, intervaloSeg * 1000));
  }
}
