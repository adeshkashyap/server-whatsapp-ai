const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '', 
  user: '',
  password: '',
  database: '',
  port: 3201
});

module.exports = pool;
